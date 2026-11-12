import sqlite3
import tempfile
import json
import hashlib
from importlib import import_module
from pathlib import Path

from django.contrib.auth.models import Group, User
from django.apps import apps
from django.contrib.sessions.models import Session
from django.test import TestCase

from user.models import UserInfo

from .legacy_import import (
    HinghwaImporter,
    account_priority,
    build_review_candidates,
    import_demo_fixture,
    normalize_legacy_location,
    open_legacy_database,
    parse_legacy_datetime,
    resolve_dialect,
    resolve_legacy_recording_location,
)
from .models import (
    Can,
    Dialect,
    DialectCircle,
    Entry,
    EvidenceRecord,
    Flavor,
    LegacyImportRecord,
    LegacyReviewCandidate,
    Package,
    PronunciationVariant,
    Recording,
    RecordingEntryLink,
)

SOURCE_SCHEMA = """
CREATE TABLE auth_user (
    id INTEGER PRIMARY KEY, password TEXT, last_login TEXT, is_superuser INTEGER,
    username TEXT, first_name TEXT, last_name TEXT, email TEXT, is_staff INTEGER,
    is_active INTEGER, date_joined TEXT
);
CREATE TABLE user_userinfo (
    user_id INTEGER PRIMARY KEY, wechat TEXT, qq TEXT, nickname TEXT, birthday TEXT,
    telephone TEXT, avatar TEXT, county TEXT, town TEXT,
    points_now INTEGER, points_sum INTEGER
);
CREATE TABLE word_word (
    id INTEGER PRIMARY KEY, word TEXT, definition TEXT, annotation TEXT,
    mandarin TEXT, standard_ipa TEXT, standard_pinyin TEXT, visibility INTEGER,
    contributor_id INTEGER, tags TEXT
);
CREATE TABLE word_pronunciation (
    id INTEGER PRIMARY KEY, source TEXT, ipa TEXT, pinyin TEXT, county TEXT,
    town TEXT, visibility INTEGER, views INTEGER, contributor_id INTEGER,
    word_id INTEGER, verifier_id INTEGER, upload_time TEXT
);
"""


class LegacyLocationTests(TestCase):
    def test_normalizes_required_branches_and_unknown_user_location(self):
        self.assertEqual(
            normalize_legacy_location("仙游县", "鲤城街道", for_user=True)[
                "qualified_code"
            ],
            "闽.莆仙.仙游.城关",
        )
        self.assertEqual(
            normalize_legacy_location("仙游县", "枫亭镇")["qualified_code"],
            "闽.莆仙.仙游.枫亭",
        )
        self.assertEqual(
            normalize_legacy_location("涵江", "国欢镇")["qualified_code"],
            "闽.莆仙.莆田.国欢",
        )
        self.assertIsNone(
            normalize_legacy_location("福州市", "鼓楼区", for_user=True)[
                "qualified_code"
            ]
        )

    def test_unseeded_leaf_uses_only_its_known_branch(self):
        original = normalize_legacy_location("仙游县", "未列镇")
        dialect, mapped = resolve_legacy_recording_location(original)
        self.assertEqual(dialect.qualified_code, "闽.莆仙.仙游")
        self.assertEqual(mapped["reason"], "unseeded_leaf_branch_fallback")
        self.assertEqual(mapped["legacy"], {"county": "仙游县", "town": "未列镇"})
        self.assertEqual(original["qualified_code"], "闽.莆仙.仙游.未列")
        putian, putian_mapping = resolve_legacy_recording_location(
            normalize_legacy_location("涵江", "未列镇")
        )
        self.assertEqual(putian.qualified_code, "闽.莆仙.莆田")
        self.assertEqual(putian_mapping["reason"], "unseeded_leaf_branch_fallback")

        for county, town, expected, reason in (
            ("仙游县", "枫亭镇", "闽.莆仙.仙游.枫亭", "mapped"),
            ("涵江", "国欢镇", "闽.莆仙.莆田.国欢", "mapped"),
            ("福州市", "鼓楼区", "闽.莆仙", "unrecognized_location"),
        ):
            dialect, mapped = resolve_legacy_recording_location(
                normalize_legacy_location(county, town)
            )
            self.assertEqual(dialect.qualified_code, expected)
            self.assertEqual(mapped["reason"], reason)
        dialect, mapping = resolve_legacy_recording_location(
            normalize_legacy_location("福州市", "鼓楼区", for_user=True)
        )
        self.assertIsNone(dialect)
        self.assertIsNone(mapping["qualified_code"])


class AccountPriorityTests(TestCase):
    def test_admin_status_precedes_last_login_then_newer_login_wins(self):
        admin_old = account_priority(
            is_staff=True,
            is_superuser=False,
            last_login="2020-01-01 00:00:00",
        )
        ordinary_new = account_priority(
            is_staff=False,
            is_superuser=False,
            last_login="2025-01-01 00:00:00",
        )
        admin_new = account_priority(
            is_staff=True,
            is_superuser=False,
            last_login="2024-01-01 00:00:00",
        )
        admin_never = account_priority(
            is_staff=True,
            is_superuser=False,
            last_login=None,
        )

        self.assertGreater(admin_old, ordinary_new)
        self.assertGreater(admin_new, admin_old)
        self.assertGreater(admin_old, admin_never)


class DialectSeedTests(TestCase):
    def test_seed_is_complete_and_idempotent(self):
        migration = import_module("guantou.migrations.0012_seed_puxian_dialects")
        migration.seed_puxian_dialects(apps, None)
        city = resolve_dialect("闽.莆仙.莆田.城里")
        city.name = "人工维护的城里话"
        city.sort_order = 999
        city.save(update_fields=["name", "sort_order", "updated_at"])
        migration.seed_puxian_dialects(apps, None)
        self.assertEqual(Dialect.objects.count(), 56)
        self.assertEqual(DialectCircle.objects.count(), 56)
        required = (
            "闽.莆仙",
            "闽.莆仙.莆田",
            "闽.莆仙.莆田.城里",
            "闽.莆仙.莆田.江口",
            "闽.莆仙.莆田.湄洲",
            "闽.莆仙.仙游",
            "闽.莆仙.仙游.城关",
            "闽.莆仙.仙游.游洋",
            "闽.莆仙.仙游.枫亭",
        )
        self.assertTrue(all(resolve_dialect(code) is not None for code in required))
        city.refresh_from_db()
        self.assertEqual(city.name, "人工维护的城里话")
        self.assertEqual(city.sort_order, 999)


class LegacyImportTests(TestCase):
    def setUp(self):
        super().setUp()
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.source_path = f"{self.directory.name}/legacy.sqlite3"
        connection = sqlite3.connect(self.source_path)
        connection.executescript(SOURCE_SCHEMA)
        users = [
            (
                1,
                "hash-1",
                "2020-01-01 00:00:00",
                1,
                "source_target_merge",
                "",
                "",
                "one@test.invalid",
                1,
                1,
                "2020-01-01 00:00:00",
            ),
            (
                2,
                "hash-2",
                "2024-01-02 00:00:00",
                1,
                "retired_login",
                "",
                "",
                "duplicate@test.invalid",
                1,
                1,
                "2020-01-02 00:00:00",
            ),
            (
                3,
                "hash-3",
                "2024-01-01 00:00:00",
                1,
                "wechat_survivor",
                "",
                "",
                "DUPLICATE@test.invalid",
                1,
                1,
                "2020-01-03 00:00:00",
            ),
        ]
        infos = [
            (
                1,
                "",
                "",
                "合并到目标",
                "1970-01-01",
                "13900000000",
                "默认头像",
                "外地",
                "未知",
                5,
                10,
            ),
            (
                2,
                "",
                "",
                "退役账号",
                "1990-01-01",
                "13800000000",
                "",
                "仙游县",
                "枫亭镇",
                7,
                12,
            ),
            (
                3,
                "wx-openid",
                "",
                "微信主体",
                "1991-01-01",
                "13800000000",
                "",
                "仙游县",
                "枫亭镇",
                11,
                21,
            ),
        ]
        connection.executemany(
            "INSERT INTO auth_user VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", users
        )
        connection.executemany(
            "INSERT INTO user_userinfo VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            infos,
        )
        words = [
            (10, "食", "吃", "旧注", "['吃']", "sieh4", "sih4", 1, 1, "['动作']"),
            (11, "行", "走", "", "['走路']", "kiaŋ2", "kiang2", 0, 2, "[]"),
        ]
        connection.executemany(
            "INSERT INTO word_word VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", words
        )
        connection.execute(
            "INSERT INTO word_pronunciation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                20,
                "https://example.test/demo.mp3",
                "kiaŋ2",
                "kiang2",
                "仙游县",
                "枫亭镇",
                1,
                4,
                2,
                11,
                3,
                "2021-01-01 00:00:00",
            ),
        )
        connection.commit()
        connection.close()

        self.target = User.objects.create_user(
            username="target", password="keep-me", email="target@test.invalid"
        )
        UserInfo.objects.create(
            user=self.target,
            telephone="13900000000",
            points_now=2,
            points_sum=3,
        )

    def test_dry_run_is_read_only_and_apply_is_idempotent(self):
        with open_legacy_database(self.source_path) as connection:
            dry_report = HinghwaImporter(connection, apply=False).run()
        self.assertEqual(dry_report["source_counts"]["auth_user"], 3)
        self.assertEqual(dry_report["normalized"]["duplicate_email_accounts"], 2)
        self.assertEqual(dry_report["normalized"]["source_identity_wins"], 1)
        self.assertEqual(
            dry_report["v2_expected"],
            {"entries": 2, "entries_without_recordings": 1, "recordings": 1},
        )
        self.assertEqual(LegacyImportRecord.objects.count(), 0)
        self.assertEqual(User.objects.count(), 1)

        self.target.groups.add(Group.objects.create(name="retired-target-role"))
        self.client.force_login(self.target)
        retired_session_key = self.client.session.session_key
        with open_legacy_database(self.source_path) as connection:
            report = HinghwaImporter(connection, apply=True).run()
        self.assertFalse(report["failed"])
        self.assertEqual(report["created"]["users"], 1)
        self.assertEqual(User.objects.count(), 2)

        self.target.refresh_from_db()
        target_info = self.target.user_info
        target_info.refresh_from_db()
        self.assertEqual(self.target.username, "source_target_merge")
        self.assertEqual(self.target.password, "hash-1")
        self.assertTrue(self.target.is_staff)
        self.assertTrue(self.target.is_superuser)
        self.assertFalse(self.target.groups.exists())
        self.assertFalse(
            Session.objects.filter(session_key=retired_session_key).exists()
        )
        self.assertEqual((target_info.points_now, target_info.points_sum), (7, 13))

        survivor = User.objects.get(username="retired_login")
        self.assertEqual(survivor.password, "hash-2")
        self.assertEqual(survivor.email, "")
        self.assertTrue(survivor.is_superuser)
        self.assertEqual(survivor.user_info.wechat, "")
        self.assertEqual(
            (survivor.user_info.points_now, survivor.user_info.points_sum), (18, 33)
        )
        self.assertFalse(User.objects.filter(username="wechat_survivor").exists())
        # The active importer writes the V2 domain only. Legacy domain tables remain
        # readable archives and must not receive new rows.
        self.assertEqual(Flavor.objects.count(), 0)
        self.assertEqual(Can.objects.count(), 0)
        self.assertEqual(Package.objects.count(), 0)
        self.assertEqual(Entry.objects.count(), 2)
        self.assertEqual(Recording.objects.count(), 1)
        self.assertEqual(RecordingEntryLink.objects.count(), 1)
        silent_entry = Entry.objects.get(entry_writings__writing__text="食")
        recorded_entry = Entry.objects.get(entry_writings__writing__text="行")
        self.assertFalse(silent_entry.recording_links.exists())
        self.assertEqual(
            recorded_entry.recording_links.get().recording_id,
            Recording.objects.get().id,
        )
        self.assertFalse(recorded_entry.visibility)
        self.assertEqual(
            recorded_entry.pronunciation_variants.get(
                ipa="kiaŋ2", dialect=resolve_dialect("闽.莆仙.仙游.枫亭")
            ).dialect.qualified_code,
            "闽.莆仙.仙游.枫亭",
        )
        self.assertEqual(
            silent_entry.pronunciation_variants.get(ipa="sieh4").dialect.qualified_code,
            "闽.莆仙.莆田.城里",
        )
        self.assertEqual(EvidenceRecord.objects.count(), 3)
        self.assertNotIn("legacy_location", Recording.objects.get().metadata)

        counts = {
            "users": User.objects.count(),
            "v2_entries": Entry.objects.count(),
            "v2_recordings": Recording.objects.count(),
            "v2_links": RecordingEntryLink.objects.count(),
            "v2_evidence": EvidenceRecord.objects.count(),
            "ledger": LegacyImportRecord.objects.count(),
        }

        # Simulate a database imported by the previous fixed-target-wins rule.
        self.target.username = "target"
        self.target.set_password("keep-me")
        self.target.is_staff = False
        self.target.is_superuser = False
        self.target.save(
            update_fields=["username", "password", "is_staff", "is_superuser"]
        )
        old_ledger = LegacyImportRecord.objects.get(
            source_system="hinghwa-dict-backend",
            source_table="auth_user",
            source_id="1",
        )
        old_ledger.metadata = {
            "privileges_inherited": False,
            "email_cleared": False,
        }
        old_ledger.save(update_fields=["metadata", "updated_at"])

        with open_legacy_database(self.source_path) as connection:
            rerun = HinghwaImporter(connection, apply=True).run()
        self.assertEqual(rerun["skipped"]["users"], 3)
        self.assertEqual(rerun["normalized"]["account_identity_repairs"], 1)
        self.assertEqual(
            counts,
            {
                "users": User.objects.count(),
                "v2_entries": Entry.objects.count(),
                "v2_recordings": Recording.objects.count(),
                "v2_links": RecordingEntryLink.objects.count(),
                "v2_evidence": EvidenceRecord.objects.count(),
                "ledger": LegacyImportRecord.objects.count(),
            },
        )
        self.target.refresh_from_db()
        self.assertEqual(self.target.username, "source_target_merge")
        self.assertEqual(self.target.password, "hash-1")
        self.assertTrue(self.target.is_staff)
        self.assertTrue(self.target.is_superuser)
        target_info.refresh_from_db()
        self.assertEqual((target_info.points_now, target_info.points_sum), (7, 13))

    def test_unseeded_legacy_town_imports_without_dropping_recording(self):
        connection = sqlite3.connect(self.source_path)
        connection.execute(
            "UPDATE word_pronunciation SET town = ? WHERE id = ?", ("未列镇", 20)
        )
        connection.commit()
        connection.close()
        source_hash = hashlib.sha256(Path(self.source_path).read_bytes()).hexdigest()

        with open_legacy_database(self.source_path) as source:
            dry_report = HinghwaImporter(source, apply=False).run()
        self.assertEqual(dry_report["failed"], [])
        self.assertEqual(dry_report["normalized"]["unseeded_leaf_branch_fallback"], 1)

        with open_legacy_database(self.source_path) as source:
            report = HinghwaImporter(source, apply=True).run()
        self.assertEqual(report["failed"], [])
        self.assertEqual(report["source_counts"]["word_pronunciation"], 1)
        self.assertEqual(Recording.objects.count(), 1)
        recording = Recording.objects.get()
        self.assertEqual(recording.usage_dialect.qualified_code, "闽.莆仙.仙游")
        self.assertEqual(
            recording.metadata["location_mapping"], "unseeded_leaf_branch_fallback"
        )
        evidence = EvidenceRecord.objects.get(
            source_metadata__table="word_pronunciation"
        )
        self.assertEqual(evidence.source_metadata["county"], "仙游县")
        self.assertEqual(evidence.source_metadata["town"], "未列镇")
        self.assertEqual(
            evidence.source_metadata["location_mapping"],
            "unseeded_leaf_branch_fallback",
        )
        self.assertEqual(
            hashlib.sha256(Path(self.source_path).read_bytes()).hexdigest(), source_hash
        )

    def test_unknown_county_keeps_broad_dialect_and_original_area(self):
        connection = sqlite3.connect(self.source_path)
        connection.execute(
            "UPDATE word_pronunciation SET county = ?, town = ? WHERE id = ?",
            ("外地", "未识别区", 20),
        )
        connection.commit()
        connection.close()
        with open_legacy_database(self.source_path) as source:
            report = HinghwaImporter(source, apply=True).run()
        self.assertEqual(report["failed"], [])
        recording = Recording.objects.get()
        self.assertEqual(recording.usage_dialect.qualified_code, "闽.莆仙")
        self.assertEqual(
            recording.metadata["location_mapping"], "unrecognized_location"
        )
        evidence = EvidenceRecord.objects.get(
            source_metadata__table="word_pronunciation"
        )
        self.assertEqual(evidence.source_metadata["county"], "外地")
        self.assertEqual(evidence.source_metadata["town"], "未识别区")
        self.assertEqual(
            evidence.source_metadata["location_mapping"], "unrecognized_location"
        )

    def test_existing_v1_archive_does_not_block_independent_v2_import(self):
        with open_legacy_database(self.source_path) as connection:
            importer = HinghwaImporter(connection, apply=True)
            importer.analyze()
            importer.import_users()
            importer.import_words()
            importer.import_recordings()

        self.assertEqual(Flavor.objects.count(), 2)
        self.assertEqual(Can.objects.count(), 1)
        self.assertEqual(Entry.objects.count(), 0)
        self.assertEqual(Recording.objects.count(), 0)

        with open_legacy_database(self.source_path) as connection:
            report = HinghwaImporter(connection, apply=True).run()

        self.assertFalse(report["failed"])
        self.assertNotIn("words", report["created"])
        self.assertNotIn("recordings", report["created"])
        self.assertNotIn("words", report["skipped"])
        self.assertNotIn("recordings", report["skipped"])
        self.assertEqual(report["created"]["v2_entries"], 2)
        self.assertEqual(report["created"]["v2_recordings"], 1)
        self.assertEqual(Flavor.objects.count(), 2)
        self.assertEqual(Can.objects.count(), 1)
        self.assertEqual(Entry.objects.count(), 2)
        self.assertEqual(Recording.objects.count(), 1)

    def test_v2_normalizes_search_fields_but_preserves_source_text_exactly(self):
        connection = sqlite3.connect(self.source_path)
        connection.execute(
            "UPDATE word_word SET word = ?, definition = ?, standard_ipa = ?, "
            "standard_pinyin = ? WHERE id = 11",
            (" 行 ", " 原样释义 ", " kiaŋ2 ", " kiang2 "),
        )
        connection.execute(
            "UPDATE word_pronunciation SET ipa = ?, pinyin = ? WHERE id = 20",
            (" kiaŋ2 ", " kiang2 "),
        )
        connection.commit()
        connection.close()

        with open_legacy_database(self.source_path) as source:
            HinghwaImporter(source, apply=True).run()

        entry = Entry.objects.get(entry_writings__writing__text="行")
        self.assertEqual(entry.summary, " 原样释义 ")
        word_evidence = EvidenceRecord.objects.get(
            citation="hinghwa-dict-backend:word_word:11"
        )
        self.assertEqual(word_evidence.original_writing, " 行 ")
        self.assertEqual(word_evidence.original_gloss, " 原样释义 ")
        self.assertEqual(word_evidence.original_pronunciation, " kiang2 ")
        recording_evidence = EvidenceRecord.objects.exclude(
            citation="hinghwa-dict-backend:word_word:11"
        ).get(source_metadata__table="word_pronunciation")
        self.assertEqual(recording_evidence.original_pronunciation, " kiang2 ")
        self.assertEqual(recording_evidence.source_metadata["ipa"], " kiaŋ2 ")

    def test_v2_rerun_reports_source_changes_without_overwriting_evidence(self):
        with open_legacy_database(self.source_path) as source:
            HinghwaImporter(source, apply=True).run()
        entry = Entry.objects.get(entry_writings__writing__text="行")
        evidence = EvidenceRecord.objects.get(
            citation="hinghwa-dict-backend:word_word:11"
        )

        connection = sqlite3.connect(self.source_path)
        connection.execute(
            "UPDATE word_word SET definition = ? WHERE id = 11",
            ("来源后来被改写",),
        )
        connection.commit()
        connection.close()
        with open_legacy_database(self.source_path) as source:
            report = HinghwaImporter(source, apply=True).run()

        self.assertIn(
            {
                "table": "word_word",
                "source_id": 11,
                "target_model": "guantou.Entry",
                "reason": "source_changed_after_import",
            },
            report["conflicts"],
        )
        entry.refresh_from_db()
        evidence.refresh_from_db()
        self.assertEqual(entry.summary, "走")
        self.assertEqual(evidence.original_gloss, "走")

    def test_import_persists_review_candidates_without_applying_them(self):
        connection = sqlite3.connect(self.source_path)
        connection.execute(
            "UPDATE word_word SET definition = ? WHERE id = 10",
            ("①吃。②进食。",),
        )
        connection.execute(
            "INSERT INTO word_word VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (12, "行", "行业", "", "['行业']", "", "", 1, 1, "[]"),
        )
        connection.execute(
            "INSERT INTO word_pronunciation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                21,
                "https://example.test/second.mp3",
                "tsau3",
                "zau3",
                "仙游县",
                "枫亭镇",
                1,
                0,
                2,
                11,
                None,
                "2021-01-02 00:00:00",
            ),
        )
        connection.commit()
        connection.row_factory = sqlite3.Row
        words = connection.execute("SELECT * FROM word_word ORDER BY id").fetchall()
        recordings = connection.execute(
            "SELECT * FROM word_pronunciation ORDER BY id"
        ).fetchall()
        connection.close()

        pure_candidates = build_review_candidates(words, recordings)
        self.assertEqual(
            {item["candidate_type"] for item in pure_candidates},
            {
                "sense_segmentation",
                "pronunciation_variation",
                "entry_split",
                "possible_duplicate",
            },
        )

        with open_legacy_database(self.source_path) as source:
            report = HinghwaImporter(source, apply=True).run()

        self.assertFalse(report["failed"])
        self.assertEqual(Entry.objects.count(), 3)
        self.assertEqual(Recording.objects.count(), 2)
        recorded_entry = Entry.objects.get(
            entry_writings__writing__text="行", summary="走"
        )
        self.assertEqual(recorded_entry.recording_links.count(), 2)
        self.assertEqual(LegacyReviewCandidate.objects.count(), 4)
        duplicate = LegacyReviewCandidate.objects.get(
            candidate_type=LegacyReviewCandidate.CandidateType.POSSIBLE_DUPLICATE
        )
        self.assertEqual(duplicate.entries.count(), 2)
        self.assertEqual(
            set(duplicate.entries.values_list("summary", flat=True)),
            {"走", "行业"},
        )
        numbered_entry = Entry.objects.get(entry_writings__writing__text="食")
        self.assertEqual(numbered_entry.senses.count(), 1)
        self.assertEqual(numbered_entry.senses.get().gloss, "①吃。②进食。")
        split_candidate = LegacyReviewCandidate.objects.get(
            candidate_type=LegacyReviewCandidate.CandidateType.ENTRY_SPLIT
        )
        self.assertEqual(split_candidate.status, LegacyReviewCandidate.Status.PENDING)

        stable_counts = {
            "entries": Entry.objects.count(),
            "recordings": Recording.objects.count(),
            "candidates": LegacyReviewCandidate.objects.count(),
            "ledger": LegacyImportRecord.objects.count(),
        }
        with open_legacy_database(self.source_path) as source:
            rerun = HinghwaImporter(source, apply=True).run()
        self.assertEqual(rerun["skipped"]["v2_entries"], 3)
        self.assertEqual(rerun["skipped"]["v2_recordings"], 2)
        self.assertEqual(rerun["skipped"]["v2_review_candidates"], 4)
        self.assertEqual(
            stable_counts,
            {
                "entries": Entry.objects.count(),
                "recordings": Recording.objects.count(),
                "candidates": LegacyReviewCandidate.objects.count(),
                "ledger": LegacyImportRecord.objects.count(),
            },
        )

    def test_more_recent_target_login_wins_when_admin_status_is_equal(self):
        connection = sqlite3.connect(self.source_path)
        connection.execute(
            "UPDATE auth_user SET is_staff = 0, is_superuser = 0, "
            "last_login = '2020-01-01 00:00:00' WHERE id = 1"
        )
        connection.commit()
        connection.close()
        self.target.last_login = parse_legacy_datetime("2025-01-01 00:00:00")
        self.target.save(update_fields=["last_login"])

        with open_legacy_database(self.source_path) as connection:
            HinghwaImporter(connection, apply=True).run()

        self.target.refresh_from_db()
        self.assertEqual(self.target.username, "target")
        self.assertTrue(self.target.check_password("keep-me"))
        ledger = LegacyImportRecord.objects.get(
            source_system="hinghwa-dict-backend",
            source_table="auth_user",
            source_id="1",
        )
        self.assertEqual(ledger.metadata["identity_winner"], "target")

    def test_dry_run_reports_third_party_identity_conflict(self):
        User.objects.create_user(username="source_target_merge")

        with open_legacy_database(self.source_path) as connection:
            report = HinghwaImporter(connection, apply=False).run()

        self.assertIn({"source_ids": [1], "reason": "username"}, report["conflicts"])
        self.assertEqual(LegacyImportRecord.objects.count(), 0)

    def test_sanitized_fixture_dry_run_and_idempotent_load(self):
        payload = {
            "schema_version": 2,
            "format": "guantou-entry-recording-demo",
            "actors": [
                {"key": "actor_1", "display_name": "示例贡献者1", "role": "contributor"}
            ],
            "items": [
                {
                    "key": "entry_recording_1",
                    "dialect": "闽.莆仙.仙游.枫亭",
                    "entry": {
                        "summary": "吃",
                        "identity_note": "",
                        "status": "reviewed",
                        "visibility": True,
                        "creator": "actor_1",
                        "writing": {"text": "食", "form_type": "uncertain"},
                        "sense": {
                            "gloss": "吃",
                            "usage_note": "",
                            "examples": [],
                            "status": "reviewed",
                        },
                        "pronunciation": {
                            "ipa": "sieh4",
                            "base_romanization": "",
                            "surface_romanization": "sih4",
                            "reading_type": "general",
                            "status": "reviewed",
                        },
                    },
                    "recording": {
                        "audio_url": "https://example.test/fixture.mp3",
                        "recording_type": "word",
                        "original_gloss": "吃",
                        "duration_ms": 0,
                        "rights_statement": "",
                        "status": "published",
                        "visibility": True,
                        "recorder": "actor_1",
                    },
                    "link": {
                        "role": "primary",
                        "status": "accepted",
                        "creator": "actor_1",
                        "reviewer": None,
                        "review_reason": "",
                    },
                }
            ],
        }
        dry = import_demo_fixture(payload, apply=False)
        self.assertEqual(dry["source_counts"]["items"], 1)
        self.assertFalse(User.objects.filter(username="hinghwa_demo_actor_1").exists())
        first = import_demo_fixture(payload, apply=True)
        second = import_demo_fixture(payload, apply=True)
        self.assertEqual(first["created"]["items"], 1)
        self.assertEqual(first["created"]["entries"], 1)
        self.assertEqual(first["created"]["recordings"], 1)
        self.assertEqual(second["skipped"]["items"], 1)
        self.assertEqual(
            Entry.objects.filter(
                metadata__demo_fixture_key="entry_recording_1"
            ).count(),
            1,
        )
        self.assertEqual(
            Recording.objects.filter(
                metadata__demo_fixture_key="entry_recording_1"
            ).count(),
            1,
        )
        demo_user = User.objects.get(username="hinghwa_demo_actor_1")
        self.assertFalse(demo_user.has_usable_password())
        self.assertEqual(demo_user.email, "")
        self.assertFalse(demo_user.is_staff)
        self.assertFalse(demo_user.is_superuser)

    def test_repository_demo_fixture_uses_entry_recording_v2_schema(self):
        fixture_path = Path(__file__).parent / "fixtures" / "hinghwa_demo.json"
        payload = json.loads(fixture_path.read_text(encoding="utf-8"))

        report = import_demo_fixture(payload, apply=False)

        self.assertEqual(report["format"], "guantou-entry-recording-demo")
        self.assertEqual(report["source_counts"]["items"], 5)
