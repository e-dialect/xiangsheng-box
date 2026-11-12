import ast
import hashlib
import json
import re
import sqlite3
from collections import defaultdict
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

from django.contrib.auth import SESSION_KEY
from django.contrib.auth.models import User
from django.contrib.sessions.models import Session
from django.db import models, transaction
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

from user.models import UserInfo
from user.verification import normalize_email, normalize_phone

from .models import (
    Can,
    Dialect,
    Entry,
    EntrySense,
    EntryWriting,
    EvidenceLink,
    EvidenceRecord,
    Flavor,
    FlavorPackage,
    LegacyImportRecord,
    LegacyReviewCandidate,
    Nameplate,
    Package,
    Pronunciation,
    PronunciationVariant,
    Recording,
    RecordingEntryLink,
    WritingForm,
)

SOURCE_SYSTEM = "hinghwa-dict-backend"
DEMO_DIALECT_CODES = (
    "闽.莆仙.莆田.城里",
    "闽.莆仙.莆田.江口",
    "闽.莆仙.莆田.湄洲",
    "闽.莆仙.仙游.城关",
    "闽.莆仙.仙游.枫亭",
)
REQUIRED_SOURCE_COLUMNS = {
    "auth_user": {
        "id",
        "password",
        "last_login",
        "is_superuser",
        "username",
        "email",
        "is_staff",
        "is_active",
        "date_joined",
    },
    "user_userinfo": {
        "user_id",
        "wechat",
        "nickname",
        "birthday",
        "telephone",
        "avatar",
        "county",
        "town",
        "points_now",
        "points_sum",
    },
    "word_word": {
        "id",
        "word",
        "definition",
        "annotation",
        "mandarin",
        "standard_ipa",
        "standard_pinyin",
        "visibility",
        "contributor_id",
        "tags",
    },
    "word_pronunciation": {
        "id",
        "source",
        "ipa",
        "pinyin",
        "county",
        "town",
        "visibility",
        "views",
        "contributor_id",
        "word_id",
        "verifier_id",
        "upload_time",
    },
}

PUTIAN_COUNTIES = {
    "城厢区",
    "荔城区",
    "涵江区",
    "涵江",
    "秀屿区",
    "莆田市",
    "莆田",
}
XIANYOU_COUNTIES = {"仙游县", "仙游"}
CIRCLED_NUMBER_RE = re.compile(r"([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])")
WHITESPACE_RE = re.compile(r"\s+")
PRIMARY_TARGET_MODELS = {
    "auth_user": "auth.User",
    "word_word": "guantou.Flavor",
    "word_pronunciation": "guantou.Can",
}


@contextmanager
def open_legacy_database(path):
    source = Path(path).expanduser().resolve()
    if not source.is_file():
        raise ValueError(f"源数据库不存在: {source}")
    connection = sqlite3.connect(f"file:{source}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
    finally:
        connection.close()


def safe_legacy_list(value):
    if isinstance(value, list):
        return value
    text = str(value or "").strip()
    if not text:
        return []
    try:
        parsed = ast.literal_eval(text)
    except (ValueError, SyntaxError):
        return [text]
    return [str(item) for item in parsed] if isinstance(parsed, (list, tuple)) else []


def clean_legacy_text(value):
    return WHITESPACE_RE.sub(" ", str(value or "")).strip()


def split_numbered_senses(definition):
    """Parse circled-number segments as suggestions, never as final senses."""

    parts = CIRCLED_NUMBER_RE.split(clean_legacy_text(definition))
    return [
        {
            "marker": parts[index],
            "text": parts[index + 1].strip() if index + 1 < len(parts) else "",
        }
        for index in range(1, len(parts), 2)
    ]


def payload_fingerprint(payload):
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def build_review_candidates(words, recordings):
    """Build deterministic, non-binding candidates from read-only source rows."""

    word_rows = [dict(row) for row in words]
    recording_rows = [dict(row) for row in recordings]
    words_by_id = {int(row["id"]): row for row in word_rows}
    candidates = []

    spellings = defaultdict(list)
    for row in word_rows:
        spellings[clean_legacy_text(row["word"])].append(row)
        segments = split_numbered_senses(row["definition"])
        markers = {segment["marker"] for segment in segments}
        if {"①", "②"}.issubset(markers):
            candidates.append(
                {
                    "candidate_type": "sense_segmentation",
                    "candidate_key": f"word:{row['id']}",
                    "source_word_ids": [int(row["id"])],
                    "payload": {
                        "writing": clean_legacy_text(row["word"]),
                        "original_definition": str(row["definition"] or ""),
                        "segments": segments,
                        "decision": "suggest_sense_segmentation",
                    },
                }
            )
        elif len(segments) >= 2:
            candidates.append(
                {
                    "candidate_type": "numbering_anomaly",
                    "candidate_key": f"word:{row['id']}",
                    "source_word_ids": [int(row["id"])],
                    "payload": {
                        "writing": clean_legacy_text(row["word"]),
                        "original_definition": str(row["definition"] or ""),
                        "segments": segments,
                        "decision": "review_numbering_anomaly",
                    },
                }
            )

    for writing, rows in sorted(spellings.items()):
        if not writing or len(rows) < 2:
            continue
        source_ids = [int(row["id"]) for row in rows]
        candidates.append(
            {
                "candidate_type": "possible_duplicate",
                "candidate_key": f"writing:{payload_fingerprint(writing)[:20]}",
                "source_word_ids": source_ids,
                "payload": {
                    "writing": writing,
                    "records": [
                        {
                            "source_word_id": int(row["id"]),
                            "definition": str(row["definition"] or ""),
                            "standard_ipa": clean_legacy_text(row["standard_ipa"]),
                            "standard_pinyin": clean_legacy_text(
                                row["standard_pinyin"]
                            ),
                        }
                        for row in rows
                    ],
                    "decision": "possible_duplicate",
                },
            }
        )

    recordings_by_word = defaultdict(list)
    for row in recording_rows:
        word_id = int(row["word_id"])
        if word_id in words_by_id:
            recordings_by_word[word_id].append(row)
    for word_id, rows in sorted(recordings_by_word.items()):
        readings_by_area = defaultdict(set)
        for row in rows:
            reading = (
                clean_legacy_text(row["ipa"]),
                clean_legacy_text(row["pinyin"]),
            )
            if any(reading):
                area = (
                    clean_legacy_text(row["county"]),
                    clean_legacy_text(row["town"]),
                )
                readings_by_area[area].add(reading)
        all_readings = {
            reading for readings in readings_by_area.values() for reading in readings
        }
        if len(all_readings) > 1:
            candidates.append(
                {
                    "candidate_type": "pronunciation_variation",
                    "candidate_key": f"word:{word_id}",
                    "source_word_ids": [word_id],
                    "payload": {
                        "writing": clean_legacy_text(words_by_id[word_id]["word"]),
                        "areas": [
                            {
                                "county": area[0],
                                "town": area[1],
                                "readings": [
                                    {"ipa": reading[0], "romanization": reading[1]}
                                    for reading in sorted(readings)
                                ],
                            }
                            for area, readings in sorted(readings_by_area.items())
                        ],
                        "decision": "review_pronunciation_variation",
                    },
                }
            )
        for area, readings in sorted(readings_by_area.items()):
            if len(readings) < 2:
                continue
            candidates.append(
                {
                    "candidate_type": "entry_split",
                    "candidate_key": (
                        f"word:{word_id}:area:" f"{payload_fingerprint(area)[:20]}"
                    ),
                    "source_word_ids": [word_id],
                    "payload": {
                        "writing": clean_legacy_text(words_by_id[word_id]["word"]),
                        "county": area[0],
                        "town": area[1],
                        "readings": [
                            {"ipa": reading[0], "romanization": reading[1]}
                            for reading in sorted(readings)
                        ],
                        "decision": "suggest_entry_split_review",
                    },
                }
            )

    return sorted(
        candidates,
        key=lambda item: (item["candidate_type"], item["candidate_key"]),
    )


def normalize_legacy_location(county, town, *, for_user=False):
    county = str(county or "").strip()
    town = str(town or "").strip()
    legacy = {"county": county, "town": town}
    if county in XIANYOU_COUNTIES:
        branch = "闽.莆仙.仙游"
        street = "城关"
    elif county in PUTIAN_COUNTIES:
        branch = "闽.莆仙.莆田"
        street = "城里"
    else:
        return {
            "qualified_code": None if for_user else "闽.莆仙",
            "legacy": legacy,
            "reason": "unrecognized_location",
        }

    if not town or town == "-" or town.endswith("区"):
        return {
            "qualified_code": branch,
            "legacy": legacy,
            "reason": "branch_fallback",
        }
    if town.endswith("街道"):
        leaf = street
    elif town.endswith(("乡", "镇")):
        leaf = town[:-1]
    else:
        leaf = town
    return {
        "qualified_code": f"{branch}.{leaf}",
        "legacy": legacy,
        "reason": "mapped",
    }


def resolve_dialect(qualified_code):
    if not qualified_code:
        return None
    parent = None
    for code in qualified_code.split("."):
        parent = Dialect.objects.filter(parent=parent, code=code).first()
        if parent is None:
            return None
    return parent


def resolve_legacy_recording_location(location):
    """Use the seeded branch when a legacy town has no seeded leaf.

    Keep the original county/town in ``legacy``. Never infer another town, and
    never hide a missing branch or broader dialect seed behind this fallback.
    """
    code = location["qualified_code"]
    dialect = resolve_dialect(code)
    if dialect is not None or not code:
        return dialect, location
    branch, separator, _ = code.rpartition(".")
    if separator and branch in ("闽.莆仙.仙游", "闽.莆仙.莆田"):
        dialect = resolve_dialect(branch)
        if dialect is not None:
            return dialect, {
                **location,
                "qualified_code": branch,
                "reason": "unseeded_leaf_branch_fallback",
            }
    return None, location


def row_fingerprint(row):
    payload = {key: row[key] for key in row.keys()}
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def parse_legacy_datetime(value):
    if isinstance(value, datetime):
        parsed = value
    else:
        parsed = parse_datetime(str(value or ""))
    if parsed is not None and timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_default_timezone())
    return parsed


def account_priority(*, is_staff, is_superuser, last_login):
    parsed_login = parse_legacy_datetime(last_login)
    return (
        bool(is_staff or is_superuser),
        parsed_login.timestamp() if parsed_login else float("-inf"),
    )


def invalidate_user_sessions(user_id):
    for session in Session.objects.filter(expire_date__gt=timezone.now()):
        try:
            session_user_id = session.get_decoded().get(SESSION_KEY)
        except Exception:
            continue
        if str(session_user_id) == str(user_id):
            session.delete()


def validate_source_schema(connection):
    integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
    if integrity != "ok":
        raise ValueError(f"源数据库完整性检查失败: {integrity}")
    failures = []
    for table, required in REQUIRED_SOURCE_COLUMNS.items():
        columns = {
            row["name"]
            for row in connection.execute(f'PRAGMA table_info("{table}")').fetchall()
        }
        missing = sorted(required - columns)
        if missing:
            failures.append(f"{table}: {', '.join(missing)}")
    if failures:
        raise ValueError("源数据库缺少必要列: " + "; ".join(failures))


class HinghwaImporter:
    def __init__(self, connection, *, apply=False, limit=None):
        self.connection = connection
        self.apply = apply
        self.limit = limit
        self.user_map = {}
        self.word_map = {}
        self.v2_entry_map = {}
        self.review_candidates = []
        self.report = {
            "mode": "apply" if apply else "dry-run",
            "source": SOURCE_SYSTEM,
            "source_counts": {},
            "created": defaultdict(int),
            "skipped": defaultdict(int),
            "merged": [],
            "normalized": defaultdict(int),
            "conflicts": [],
            "unknown_locations": defaultdict(int),
            "failed": [],
        }
        validate_source_schema(connection)
        self.users = self._load_users()
        self.user_by_id = {row["id"]: row for row in self.users}
        self.duplicate_emails = self._duplicate_emails()
        self.user_groups = self._build_user_groups()

    def _load_users(self):
        return self.connection.execute("""
            SELECT u.*, i.wechat, i.qq, i.nickname, i.birthday, i.telephone,
                   i.avatar, i.county, i.town, i.points_now, i.points_sum
            FROM auth_user u
            JOIN user_userinfo i ON i.user_id = u.id
            ORDER BY u.id
            """).fetchall()

    def _duplicate_emails(self):
        grouped = defaultdict(list)
        for row in self.users:
            email = normalize_email(row["email"])
            if email:
                grouped[email].append(row["id"])
        return {email for email, ids in grouped.items() if len(ids) > 1}

    def _source_priority(self, row):
        return account_priority(
            is_staff=bool(row["is_staff"]),
            is_superuser=bool(row["is_superuser"]),
            last_login=row["last_login"],
        )

    def _source_survivor_key(self, row):
        return (
            *self._source_priority(row),
            bool(str(row["wechat"] or "").strip()),
            -int(row["id"]),
        )

    def _source_wins_target(self, row, target_user):
        target_priority = account_priority(
            is_staff=target_user.is_staff,
            is_superuser=target_user.is_superuser,
            last_login=target_user.last_login,
        )
        return self._source_priority(row) > target_priority

    def _build_user_groups(self):
        by_phone = defaultdict(list)
        singles = []
        for row in self.users:
            phone = normalize_phone(row["telephone"])
            if phone:
                by_phone[phone].append(row)
            else:
                singles.append([row])
        groups = list(singles)
        for phone, rows in by_phone.items():
            if len(rows) == 1:
                groups.append(rows)
                continue
            survivor = max(rows, key=self._source_survivor_key)
            groups.append(
                [survivor, *[row for row in rows if row["id"] != survivor["id"]]]
            )
        return sorted(groups, key=lambda rows: rows[0]["id"])

    def _source_count(self, table):
        return self.connection.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]

    def analyze(self):
        for table in REQUIRED_SOURCE_COLUMNS:
            self.report["source_counts"][table] = self._source_count(table)
        self.report["normalized"]["duplicate_email_accounts"] = sum(
            1
            for row in self.users
            if normalize_email(row["email"]) in self.duplicate_emails
        )
        self.report["normalized"]["internal_phone_merge_groups"] = sum(
            1 for rows in self.user_groups if len(rows) > 1
        )
        target_infos_by_phone = {
            normalize_phone(info.telephone): info
            for info in UserInfo.objects.select_related("user").exclude(telephone="")
        }
        target_phones = set(target_infos_by_phone)
        pending_groups = [
            rows
            for rows in self.user_groups
            if not all(self._ledger("auth_user", row["id"]) for row in rows)
        ]
        completed_target_merges = (
            LegacyImportRecord.objects.filter(
                source_system=SOURCE_SYSTEM,
                source_table="auth_user",
                action="merged_target_phone",
            )
            .values("target_id")
            .distinct()
            .count()
        )
        self.report["normalized"]["target_phone_merges"] = (
            completed_target_merges
            + sum(
                1
                for rows in pending_groups
                if normalize_phone(rows[0]["telephone"]) in target_phones
            )
        )
        target_usernames = set(User.objects.values_list("username", flat=True))
        target_emails = {
            normalize_email(value)
            for value in User.objects.exclude(email="").values_list("email", flat=True)
        }
        target_wechats = set(
            UserInfo.objects.exclude(wechat="").values_list("wechat", flat=True)
        )
        for rows in pending_groups:
            survivor = rows[0]
            target_info = target_infos_by_phone.get(
                normalize_phone(survivor["telephone"])
            )
            if target_info:
                if self._source_wins_target(survivor, target_info.user):
                    self.report["normalized"]["source_identity_wins"] += 1
                    conflict = self._identity_conflict(survivor, target_info.user)
                    if conflict:
                        self._add_conflict(rows, conflict)
                continue
            email = normalize_email(survivor["email"])
            if email in self.duplicate_emails:
                email = ""
            reason = None
            if survivor["username"] in target_usernames:
                reason = "username"
            elif str(survivor["wechat"] or "").strip() in target_wechats:
                reason = "wechat"
            elif email and email in target_emails:
                reason = "email"
            if reason:
                self._add_conflict(rows, reason)
        for row in self.users:
            mapping = normalize_legacy_location(
                row["county"], row["town"], for_user=True
            )
            if mapping["reason"] == "unrecognized_location":
                key = f"{row['county']}|{row['town']}"
                self.report["unknown_locations"][key] += 1
        pronunciation_locations = self.connection.execute(
            "SELECT county, town, COUNT(*) AS count FROM word_pronunciation "
            "GROUP BY county, town"
        ).fetchall()
        for row in pronunciation_locations:
            mapping = normalize_legacy_location(row["county"], row["town"])
            dialect, mapping = resolve_legacy_recording_location(mapping)
            if mapping["reason"] != "mapped":
                key = f"{row['county']}|{row['town']}->{mapping['qualified_code']}"
                self.report["unknown_locations"][key] += row["count"]
            if mapping["reason"] == "unseeded_leaf_branch_fallback":
                self.report["normalized"]["unseeded_leaf_branch_fallback"] += row[
                    "count"
                ]
            if dialect is None:
                self.report["failed"].append(
                    {
                        "table": "word_pronunciation",
                        "location": f"{row['county']}|{row['town']}",
                        "reason": "dialect_unmapped",
                        "affected": row["count"],
                    }
                )
        words = self.connection.execute(
            "SELECT * FROM word_word ORDER BY id"
        ).fetchall()
        recordings = self.connection.execute(
            "SELECT * FROM word_pronunciation ORDER BY id"
        ).fetchall()
        recorded_word_ids = {int(row["word_id"]) for row in recordings}
        self.review_candidates = build_review_candidates(words, recordings)
        candidate_counts = defaultdict(int)
        for candidate in self.review_candidates:
            candidate_counts[candidate["candidate_type"]] += 1
        self.report["v2_expected"] = {
            "entries": len(words),
            "entries_without_recordings": sum(
                int(row["id"]) not in recorded_word_ids for row in words
            ),
            "recordings": len(recordings),
        }
        self.report["review_candidate_counts"] = dict(candidate_counts)
        self.report["review_candidates"] = self.review_candidates
        return self.final_report()

    def _add_conflict(self, rows, reason):
        item = {"source_ids": [row["id"] for row in rows], "reason": reason}
        if item not in self.report["conflicts"]:
            self.report["conflicts"].append(item)

    def _ledger(self, table, source_id, *, target_model=None):
        queryset = LegacyImportRecord.objects.filter(
            source_system=SOURCE_SYSTEM,
            source_table=table,
            source_id=str(source_id),
        )
        resolved_target = target_model or PRIMARY_TARGET_MODELS.get(table)
        if resolved_target:
            queryset = queryset.filter(target_model=resolved_target)
        return queryset.first()

    def _record_ledger(
        self,
        table,
        row,
        target,
        *,
        action="created",
        metadata=None,
    ):
        return LegacyImportRecord.objects.create(
            source_system=SOURCE_SYSTEM,
            source_table=table,
            source_id=str(row["id"]),
            target_model=target._meta.label,
            target_id=target.pk,
            fingerprint=row_fingerprint(row),
            action=action,
            metadata=metadata or {},
        )

    def _existing_user_mapping(self, source_id):
        ledger = self._ledger("auth_user", source_id)
        if ledger:
            self.user_map[source_id] = ledger.target_id
            return ledger.target_id
        return None

    def _source_email(self, row):
        email = normalize_email(row["email"])
        return "" if email in self.duplicate_emails else email

    def _identity_conflict(self, row, target_user):
        if User.objects.exclude(pk=target_user.pk).filter(username=row["username"]):
            return "username"
        email = self._source_email(row)
        if email and User.objects.exclude(pk=target_user.pk).filter(
            email__iexact=email
        ):
            return "email"
        wechat = str(row["wechat"] or "").strip()
        if wechat and UserInfo.objects.exclude(user=target_user).filter(wechat=wechat):
            return "wechat"
        qq = str(row["qq"] or "").strip()
        if qq and UserInfo.objects.exclude(user=target_user).filter(qq=qq):
            return "qq"
        return None

    def _adopt_source_identity(self, target_info, row):
        user = target_info.user
        invalidate_user_sessions(user.pk)
        user.password = row["password"]
        user.last_login = parse_legacy_datetime(row["last_login"])
        user.is_superuser = bool(row["is_superuser"])
        user.username = row["username"]
        user.first_name = row["first_name"]
        user.last_name = row["last_name"]
        user.email = self._source_email(row)
        user.is_staff = bool(row["is_staff"])
        user.is_active = bool(row["is_active"])
        user.date_joined = (
            parse_legacy_datetime(row["date_joined"])
            or user.date_joined
            or timezone.now()
        )
        user.save(
            update_fields=[
                "password",
                "last_login",
                "is_superuser",
                "username",
                "first_name",
                "last_name",
                "email",
                "is_staff",
                "is_active",
                "date_joined",
            ]
        )
        user.groups.clear()
        user.user_permissions.clear()

        location = normalize_legacy_location(row["county"], row["town"], for_user=True)
        primary_dialect = resolve_dialect(location["qualified_code"])
        birthday_text = str(row["birthday"] or "").strip()
        avatar = str(row["avatar"] or "").strip()
        target_info.wechat = str(row["wechat"] or "").strip()
        target_info.qq = str(row["qq"] or "").strip()
        target_info.nickname = row["nickname"] or row["username"]
        target_info.birthday = (
            None if birthday_text == "1970-01-01" else parse_date(birthday_text)
        )
        target_info.avatar = "" if "默认头像" in avatar else avatar
        target_info.primary_dialect = primary_dialect
        target_info.legacy_location = location["legacy"]
        target_info.save(
            update_fields=[
                "wechat",
                "qq",
                "nickname",
                "birthday",
                "avatar",
                "primary_dialect",
                "legacy_location",
                "updated_at",
            ]
        )
        if primary_dialect:
            target_info.followed_dialects.add(primary_dialect)

    def _repair_completed_user_group(self, rows):
        ledgers = [self._ledger("auth_user", row["id"]) for row in rows]
        if not ledgers or any(ledger is None for ledger in ledgers):
            return False
        if any(
            ledger.fingerprint != row_fingerprint(row)
            for ledger, row in zip(ledgers, rows, strict=True)
        ):
            self._add_conflict(rows, "source_changed_after_import")
            return False
        target_ids = {ledger.target_id for ledger in ledgers}
        if len(target_ids) != 1:
            return False
        target_info = (
            UserInfo.objects.select_related("user")
            .filter(user_id=target_ids.pop())
            .first()
        )
        if target_info is None:
            self._add_conflict(rows, "mapped_target_missing")
            return False
        survivor = rows[0]
        if target_info.user.username == survivor["username"]:
            return False
        if not self._source_wins_target(survivor, target_info.user):
            return False
        conflict = self._identity_conflict(survivor, target_info.user)
        if conflict:
            self._add_conflict(rows, conflict)
            return False
        with transaction.atomic():
            self._adopt_source_identity(target_info, survivor)
            for ledger in ledgers:
                metadata = dict(ledger.metadata or {})
                metadata.update(
                    {
                        "identity_winner": "source",
                        "privileges_inherited": True,
                        "repair_applied": True,
                    }
                )
                ledger.metadata = metadata
                ledger.save(update_fields=["metadata", "updated_at"])
        self.report["normalized"]["account_identity_repairs"] += 1
        return True

    def import_users(self):
        groups = self.user_groups[: self.limit] if self.limit else self.user_groups
        for rows in groups:
            if all(self._existing_user_mapping(row["id"]) for row in rows):
                self._repair_completed_user_group(rows)
                for row in rows:
                    ledger = self._ledger("auth_user", row["id"])
                    metadata = dict(ledger.metadata or {})
                    email_cleared = (
                        normalize_email(row["email"]) in self.duplicate_emails
                    )
                    if metadata.get("email_cleared") != email_cleared:
                        metadata["email_cleared"] = email_cleared
                        ledger.metadata = metadata
                        ledger.save(update_fields=["metadata", "updated_at"])
                self.report["skipped"]["users"] += len(rows)
                continue
            survivor = rows[0]
            phone = normalize_phone(survivor["telephone"])
            target_info = (
                UserInfo.objects.select_related("user").filter(telephone=phone).first()
                if phone
                else None
            )
            if target_info:
                source_wins = self._source_wins_target(survivor, target_info.user)
                if source_wins:
                    conflict = self._identity_conflict(survivor, target_info.user)
                    if conflict:
                        self._add_conflict(rows, conflict)
                        continue
                with transaction.atomic():
                    points_now = sum(int(row["points_now"] or 0) for row in rows)
                    points_sum = sum(int(row["points_sum"] or 0) for row in rows)
                    target_info.points_now += points_now
                    target_info.points_sum += points_sum
                    target_info.save(
                        update_fields=["points_now", "points_sum", "updated_at"]
                    )
                    for row in rows:
                        self._record_ledger(
                            "auth_user",
                            row,
                            target_info.user,
                            action="merged_target_phone",
                            metadata={
                                "identity_winner": (
                                    "source" if source_wins else "target"
                                ),
                                "privileges_inherited": source_wins,
                                "email_cleared": normalize_email(row["email"])
                                in self.duplicate_emails,
                                "retired_login": (
                                    source_wins and row["id"] != survivor["id"]
                                ),
                            },
                        )
                        self.user_map[row["id"]] = target_info.user_id
                    if source_wins:
                        self._adopt_source_identity(target_info, survivor)
                self.report["merged"].append(
                    {
                        "source_ids": [row["id"] for row in rows],
                        "target_id": target_info.user_id,
                        "reason": "target_phone_match",
                        "identity_winner": "source" if source_wins else "target",
                    }
                )
                continue

            username_conflict = User.objects.filter(
                username=survivor["username"]
            ).first()
            wechat = str(survivor["wechat"] or "").strip()
            wechat_conflict = (
                UserInfo.objects.filter(wechat=wechat).first() if wechat else None
            )
            email = normalize_email(survivor["email"])
            if email in self.duplicate_emails:
                email = ""
                self.report["normalized"]["emails_cleared"] += 1
            email_conflict = (
                User.objects.filter(email__iexact=email).first() if email else None
            )
            if username_conflict or wechat_conflict or email_conflict:
                self._add_conflict(
                    rows,
                    (
                        "username"
                        if username_conflict
                        else "wechat" if wechat_conflict else "email"
                    ),
                )
                continue

            location = normalize_legacy_location(
                survivor["county"], survivor["town"], for_user=True
            )
            primary_dialect = resolve_dialect(location["qualified_code"])
            birthday_text = str(survivor["birthday"] or "").strip()
            birthday = (
                None if birthday_text == "1970-01-01" else parse_date(birthday_text)
            )
            avatar = str(survivor["avatar"] or "").strip()
            if "默认头像" in avatar:
                avatar = ""
            with transaction.atomic():
                user = User.objects.create(
                    password=survivor["password"],
                    last_login=parse_legacy_datetime(survivor["last_login"]),
                    is_superuser=bool(survivor["is_superuser"]),
                    username=survivor["username"],
                    first_name=survivor["first_name"],
                    last_name=survivor["last_name"],
                    email=email,
                    is_staff=bool(survivor["is_staff"]),
                    is_active=bool(survivor["is_active"]),
                    date_joined=parse_legacy_datetime(survivor["date_joined"])
                    or timezone.now(),
                )
                info = UserInfo.objects.create(
                    user=user,
                    wechat=wechat,
                    qq=str(survivor["qq"] or "").strip(),
                    nickname=survivor["nickname"] or survivor["username"],
                    birthday=birthday,
                    telephone=phone,
                    avatar=avatar,
                    primary_dialect=primary_dialect,
                    legacy_location=location["legacy"],
                    points_now=sum(int(row["points_now"] or 0) for row in rows),
                    points_sum=sum(int(row["points_sum"] or 0) for row in rows),
                )
                if primary_dialect:
                    info.followed_dialects.add(primary_dialect)
                for index, row in enumerate(rows):
                    action = "created" if index == 0 else "merged_source_phone"
                    self._record_ledger(
                        "auth_user",
                        row,
                        user,
                        action=action,
                        metadata={
                            "email_cleared": normalize_email(row["email"])
                            in self.duplicate_emails,
                            "retired_login": index > 0,
                        },
                    )
                    self.user_map[row["id"]] = user.id
            self.report["created"]["users"] += 1
            if len(rows) > 1:
                self.report["merged"].append(
                    {
                        "source_ids": [row["id"] for row in rows],
                        "target_id": user.id,
                        "reason": "source_phone_duplicate",
                    }
                )

    def _user(self, source_id):
        if source_id is None:
            return None
        target_id = self.user_map.get(source_id) or self._existing_user_mapping(
            source_id
        )
        return User.objects.filter(pk=target_id).first() if target_id else None

    def _existing_word_mapping(self, source_id):
        ledger = self._ledger("word_word", source_id)
        if ledger:
            self.word_map[source_id] = ledger.target_id
            return ledger.target_id
        return None

    def import_words(self):
        query = "SELECT * FROM word_word ORDER BY id"
        params = []
        if self.limit:
            query += " LIMIT ?"
            params.append(self.limit)
        rows = self.connection.execute(query, params).fetchall()
        city_dialect = resolve_dialect("闽.莆仙.莆田.城里")
        if city_dialect is None:
            raise RuntimeError("缺少方言节点: 闽.莆仙.莆田.城里")
        for row in rows:
            if self._existing_word_mapping(row["id"]):
                self.report["skipped"]["words"] += 1
                continue
            creator = self._user(row["contributor_id"])
            if creator is None:
                self.report["failed"].append(
                    {
                        "table": "word_word",
                        "source_id": row["id"],
                        "reason": "user_unmapped",
                    }
                )
                continue
            with transaction.atomic():
                package, package_created = Package.objects.get_or_create(
                    text=row["word"],
                    package_type=Package.PackageType.UNCERTAIN,
                    defaults={"metadata": {"legacy_hinghwa_word_ids": [row["id"]]}},
                )
                if not package_created:
                    metadata = dict(package.metadata or {})
                    ids = list(metadata.get("legacy_hinghwa_word_ids", []))
                    if row["id"] not in ids:
                        ids.append(row["id"])
                        metadata["legacy_hinghwa_word_ids"] = ids
                        package.metadata = metadata
                        package.save(update_fields=["metadata", "updated_at"])
                flavor = Flavor.objects.create(
                    name=row["word"],
                    definition=row["definition"],
                    mandarin=safe_legacy_list(row["mandarin"]),
                    tags=safe_legacy_list(row["tags"]),
                    created_by=creator,
                    visibility=bool(row["visibility"]),
                    metadata={
                        "legacy": {
                            "system": SOURCE_SYSTEM,
                            "table": "word_word",
                            "id": row["id"],
                            "annotation": row["annotation"],
                            "standard_ipa": row["standard_ipa"],
                            "standard_pinyin": row["standard_pinyin"],
                        }
                    },
                )
                FlavorPackage.objects.create(
                    flavor=flavor,
                    package=package,
                    mapping_type=FlavorPackage.MappingType.PRIMARY,
                    note="兴化语记旧库字头",
                )
                standard_pronunciation = None
                if str(row["standard_ipa"] or "").strip():
                    standard_pronunciation = Pronunciation.objects.create(
                        flavor=flavor,
                        package=package,
                        dialect=city_dialect,
                        ipa=str(row["standard_ipa"]).strip(),
                        surface_romanization=str(row["standard_pinyin"] or "").strip(),
                        usage_note=str(row["annotation"] or "").strip(),
                        reading_type=Pronunciation.ReadingType.GENERAL,
                        is_canonical=True,
                        status=(
                            Pronunciation.Status.VERIFIED
                            if row["visibility"]
                            else Pronunciation.Status.DRAFT
                        ),
                        source_citation=f"{SOURCE_SYSTEM}:word_word:{row['id']}",
                        created_by=creator,
                    )
                self._record_ledger(
                    "word_word",
                    row,
                    flavor,
                    metadata={
                        "package_id": package.id,
                        "standard_pronunciation_id": (
                            standard_pronunciation.id
                            if standard_pronunciation
                            else None
                        ),
                    },
                )
                self.word_map[row["id"]] = flavor.id
            self.report["created"]["words"] += 1
            self.report["created"]["packages"] += int(package_created)
            self.report["created"]["standard_pronunciations"] += int(
                standard_pronunciation is not None
            )

    def import_recordings(self):
        query = "SELECT * FROM word_pronunciation ORDER BY id"
        params = []
        if self.limit:
            query += " LIMIT ?"
            params.append(self.limit)
        rows = self.connection.execute(query, params).fetchall()
        for row in rows:
            ledger = self._ledger("word_pronunciation", row["id"])
            if ledger:
                self.report["skipped"]["recordings"] += 1
                continue
            word_ledger = self._ledger("word_word", row["word_id"])
            if word_ledger is None:
                self.report["failed"].append(
                    {
                        "table": "word_pronunciation",
                        "source_id": row["id"],
                        "reason": "word_unmapped",
                    }
                )
                continue
            flavor = Flavor.objects.get(pk=word_ledger.target_id)
            package_id = word_ledger.metadata["package_id"]
            package = Package.objects.get(pk=package_id)
            recorder = self._user(row["contributor_id"])
            verifier = self._user(row["verifier_id"])
            if recorder is None:
                self.report["failed"].append(
                    {
                        "table": "word_pronunciation",
                        "source_id": row["id"],
                        "reason": "recorder_unmapped",
                    }
                )
                continue
            location = normalize_legacy_location(row["county"], row["town"])
            dialect, location = resolve_legacy_recording_location(location)
            if dialect is None:
                self.report["failed"].append(
                    {
                        "table": "word_pronunciation",
                        "source_id": row["id"],
                        "reason": "dialect_unmapped",
                    }
                )
                continue
            ipa = str(row["ipa"] or "").strip()
            romanization = str(row["pinyin"] or "").strip()
            with transaction.atomic():
                pronunciation = Pronunciation.objects.filter(
                    flavor=flavor,
                    package=package,
                    dialect=dialect,
                    ipa=ipa,
                    surface_romanization=romanization,
                    reading_type=Pronunciation.ReadingType.GENERAL,
                ).first()
                pronunciation_created = pronunciation is None
                if pronunciation is None:
                    pronunciation = Pronunciation.objects.create(
                        flavor=flavor,
                        package=package,
                        dialect=dialect,
                        ipa=ipa,
                        surface_romanization=romanization,
                        reading_type=Pronunciation.ReadingType.GENERAL,
                        is_canonical=False,
                        status=(
                            Pronunciation.Status.VERIFIED
                            if row["verifier_id"]
                            else Pronunciation.Status.DRAFT
                        ),
                        source_citation=(
                            f"{SOURCE_SYSTEM}:word_pronunciation:{row['id']}"
                        ),
                        created_by=recorder,
                    )
                concept = (flavor.mandarin or [flavor.name])[0]
                can = Can.objects.create(
                    audio_url=row["source"],
                    recorder=recorder,
                    submitted_dialect=dialect,
                    concept_text=str(concept)[:200],
                    source_note=f"兴化语记旧库录音 #{row['id']}",
                    status=(
                        Can.Status.VERIFIED
                        if row["verifier_id"]
                        else Can.Status.PENDING
                    ),
                    visibility=bool(row["visibility"]),
                    verifier=verifier,
                    views=max(0, int(row["views"] or 0)),
                    metadata={
                        "legacy": {
                            "system": SOURCE_SYSTEM,
                            "table": "word_pronunciation",
                            "id": row["id"],
                            "word_id": row["word_id"],
                        },
                        "legacy_location": location["legacy"],
                        "location_mapping": location["reason"],
                    },
                )
                Nameplate.objects.create(
                    can=can,
                    flavor=flavor,
                    package=package,
                    dialect=dialect,
                    pronunciation=pronunciation,
                    creator=recorder,
                    text_content=package.text,
                    definition=flavor.definition,
                    pronunciation_text=romanization or ipa,
                    evidence_level=(
                        Nameplate.EvidenceLevel.COMMUNITY
                        if row["verifier_id"]
                        else Nameplate.EvidenceLevel.MEMORY
                    ),
                    source={
                        "type": Nameplate.SourceType.ARCHIVE,
                        "system": SOURCE_SYSTEM,
                        "legacy_pronunciation_id": row["id"],
                    },
                    status=Nameplate.Status.ACTIVE,
                    weight=100 if row["verifier_id"] else 0,
                    is_primary=True,
                )
                upload_time = parse_legacy_datetime(row["upload_time"])
                if upload_time:
                    Can.objects.filter(pk=can.pk).update(
                        created_at=upload_time, updated_at=upload_time
                    )
                self._record_ledger(
                    "word_pronunciation",
                    row,
                    can,
                    metadata={"pronunciation_id": pronunciation.id},
                )
            self.report["created"]["recordings"] += 1
            self.report["created"]["recorded_pronunciations"] += int(
                pronunciation_created
            )

    def import_entries_v2(self):
        """Create one traceable Entry for every legacy word, including silent ones."""

        query = "SELECT * FROM word_word ORDER BY id"
        params = []
        if self.limit:
            query += " LIMIT ?"
            params.append(self.limit)
        rows = self.connection.execute(query, params).fetchall()
        broad_dialect = resolve_dialect("闽.莆仙")
        city_dialect = resolve_dialect("闽.莆仙.莆田.城里")
        if broad_dialect is None or city_dialect is None:
            raise RuntimeError("缺少方言节点: 闽.莆仙 或 闽.莆仙.莆田.城里")

        for row in rows:
            ledger = self._ledger(
                "word_word",
                row["id"],
                target_model=Entry._meta.label,
            )
            if ledger:
                if ledger.fingerprint != row_fingerprint(row):
                    self.report["conflicts"].append(
                        {
                            "table": "word_word",
                            "source_id": row["id"],
                            "target_model": Entry._meta.label,
                            "reason": "source_changed_after_import",
                        }
                    )
                    continue
                entry = Entry.objects.filter(pk=ledger.target_id).first()
                if entry is None:
                    self.report["failed"].append(
                        {
                            "table": "word_word",
                            "source_id": row["id"],
                            "target_model": Entry._meta.label,
                            "reason": "mapped_target_missing",
                        }
                    )
                    continue
                self.v2_entry_map[row["id"]] = entry.id
                self.report["skipped"]["v2_entries"] += 1
                continue

            creator = self._user(row["contributor_id"])
            original_writing = str(row["word"] or "")
            writing_text = original_writing.strip()
            definition = str(row["definition"] or "")
            annotation = str(row["annotation"] or "")
            original_standard_ipa = str(row["standard_ipa"] or "")
            original_standard_romanization = str(row["standard_pinyin"] or "")
            standard_ipa = original_standard_ipa.strip()
            standard_romanization = original_standard_romanization.strip()
            with transaction.atomic():
                entry = Entry.objects.create(
                    summary=definition,
                    identity_note=annotation[:240],
                    usage_dialect=broad_dialect,
                    status=Entry.Status.DRAFT,
                    created_by=creator,
                    visibility=bool(row["visibility"]),
                    metadata={
                        "legacy": {
                            "system": SOURCE_SYSTEM,
                            "table": "word_word",
                            "id": row["id"],
                        }
                    },
                )
                sense = EntrySense.objects.create(
                    entry=entry,
                    sense_number=1,
                    gloss=definition,
                    usage_note=annotation,
                    status=EntrySense.Status.DRAFT,
                    created_by=creator,
                )
                writing = None
                entry_writing = None
                if writing_text:
                    writing = WritingForm.objects.create(
                        text=writing_text,
                        normalized_text=writing_text,
                        form_type=WritingForm.FormType.UNCERTAIN,
                        metadata={
                            "legacy": {
                                "system": SOURCE_SYSTEM,
                                "table": "word_word",
                                "id": row["id"],
                            }
                        },
                    )
                    entry_writing = EntryWriting.objects.create(
                        entry=entry,
                        writing=writing,
                        relation_type=EntryWriting.RelationType.PRIMARY,
                        status=EntryWriting.Status.DRAFT,
                        created_by=creator,
                        note="兴化语记旧库原样写法，待考据类型",
                    )

                standard_variant = None
                if standard_ipa or standard_romanization:
                    standard_variant = PronunciationVariant.objects.create(
                        entry=entry,
                        dialect=city_dialect,
                        ipa=standard_ipa,
                        surface_romanization=standard_romanization,
                        reading_type=PronunciationVariant.ReadingType.GENERAL,
                        usage_note=annotation,
                        status=PronunciationVariant.Status.DRAFT,
                        created_by=creator,
                    )

                evidence = EvidenceRecord.objects.create(
                    source_type=EvidenceRecord.SourceType.LEGACY,
                    original_text=definition,
                    original_writing=original_writing,
                    original_gloss=definition,
                    original_pronunciation=(
                        original_standard_romanization or original_standard_ipa
                    ),
                    citation=f"{SOURCE_SYSTEM}:word_word:{row['id']}",
                    source_metadata={
                        "annotation": annotation,
                        "mandarin": safe_legacy_list(row["mandarin"]),
                        "standard_ipa": original_standard_ipa,
                        "standard_pinyin": original_standard_romanization,
                        "tags": safe_legacy_list(row["tags"]),
                        "visibility": bool(row["visibility"]),
                        "contributor_id": row["contributor_id"],
                    },
                    contributor=creator,
                )
                evidence_links = [
                    EvidenceLink.objects.create(
                        evidence=evidence,
                        entry=entry,
                        relation_type=EvidenceLink.RelationType.SUBMITTED,
                        created_by=creator,
                    ),
                    EvidenceLink.objects.create(
                        evidence=evidence,
                        sense=sense,
                        relation_type=EvidenceLink.RelationType.SUBMITTED,
                        created_by=creator,
                    ),
                ]
                if standard_variant:
                    evidence_links.append(
                        EvidenceLink.objects.create(
                            evidence=evidence,
                            pronunciation_variant=standard_variant,
                            relation_type=EvidenceLink.RelationType.SUBMITTED,
                            created_by=creator,
                        )
                    )
                self._record_ledger(
                    "word_word",
                    row,
                    entry,
                    metadata={
                        "sense_id": sense.id,
                        "writing_form_id": writing.id if writing else None,
                        "entry_writing_id": (
                            entry_writing.id if entry_writing else None
                        ),
                        "standard_pronunciation_variant_id": (
                            standard_variant.id if standard_variant else None
                        ),
                        "evidence_record_id": evidence.id,
                        "evidence_link_ids": [link.id for link in evidence_links],
                    },
                )
                self.v2_entry_map[row["id"]] = entry.id
            self.report["created"]["v2_entries"] += 1
            self.report["created"]["v2_senses"] += 1
            self.report["created"]["v2_writings"] += int(writing is not None)
            self.report["created"]["v2_standard_variants"] += int(
                standard_variant is not None
            )
            self.report["created"]["v2_evidence_records"] += 1

    def import_recordings_v2(self):
        """Create exactly one Recording per legacy pronunciation row."""

        query = "SELECT * FROM word_pronunciation ORDER BY id"
        params = []
        if self.limit:
            query += " LIMIT ?"
            params.append(self.limit)
        rows = self.connection.execute(query, params).fetchall()
        word_rows = {
            int(row["id"]): row
            for row in self.connection.execute(
                "SELECT * FROM word_word ORDER BY id"
            ).fetchall()
        }
        broad_dialect = resolve_dialect("闽.莆仙")
        if broad_dialect is None:
            raise RuntimeError("缺少方言节点: 闽.莆仙")

        for row in rows:
            ledger = self._ledger(
                "word_pronunciation",
                row["id"],
                target_model=Recording._meta.label,
            )
            if ledger:
                if ledger.fingerprint != row_fingerprint(row):
                    self.report["conflicts"].append(
                        {
                            "table": "word_pronunciation",
                            "source_id": row["id"],
                            "target_model": Recording._meta.label,
                            "reason": "source_changed_after_import",
                        }
                    )
                    continue
                if not Recording.objects.filter(pk=ledger.target_id).exists():
                    self.report["failed"].append(
                        {
                            "table": "word_pronunciation",
                            "source_id": row["id"],
                            "target_model": Recording._meta.label,
                            "reason": "mapped_target_missing",
                        }
                    )
                    continue
                self.report["skipped"]["v2_recordings"] += 1
                continue

            entry_ledger = self._ledger(
                "word_word",
                row["word_id"],
                target_model=Entry._meta.label,
            )
            entry = (
                Entry.objects.filter(pk=entry_ledger.target_id).first()
                if entry_ledger
                else None
            )
            word_row = word_rows.get(int(row["word_id"]))
            if entry is None or word_row is None:
                self.report["failed"].append(
                    {
                        "table": "word_pronunciation",
                        "source_id": row["id"],
                        "reason": "v2_entry_unmapped",
                    }
                )
                continue

            location = normalize_legacy_location(row["county"], row["town"])
            dialect, location = resolve_legacy_recording_location(location)
            if dialect is None:
                dialect = broad_dialect
                self.report["normalized"]["v2_recording_dialect_fallback"] += 1
            recorder = self._user(row["contributor_id"])
            verifier = self._user(row["verifier_id"])
            if recorder is None:
                self.report["normalized"]["v2_anonymous_recorders"] += 1
            original_ipa = str(row["ipa"] or "")
            original_romanization = str(row["pinyin"] or "")
            ipa = original_ipa.strip()
            romanization = original_romanization.strip()
            upload_time = parse_legacy_datetime(row["upload_time"])
            with transaction.atomic():
                recording = Recording.objects.create(
                    audio_url=str(row["source"] or ""),
                    usage_dialect=dialect,
                    recorder=recorder,
                    recording_type=Recording.RecordingType.WORD,
                    original_gloss=str(word_row["definition"] or ""),
                    status=(
                        Recording.Status.PUBLISHED
                        if row["visibility"]
                        else Recording.Status.DRAFT
                    ),
                    visibility=bool(row["visibility"]),
                    metadata={
                        "legacy": {
                            "system": SOURCE_SYSTEM,
                            "table": "word_pronunciation",
                            "id": row["id"],
                            "word_id": row["word_id"],
                        },
                        "location_mapping": location["reason"],
                        "views_at_import": max(0, int(row["views"] or 0)),
                    },
                )
                variant = None
                variant_created = False
                if ipa or romanization:
                    variant = PronunciationVariant.objects.filter(
                        entry=entry,
                        dialect=dialect,
                        ipa=ipa,
                        base_romanization="",
                        surface_romanization=romanization,
                        reading_type=PronunciationVariant.ReadingType.GENERAL,
                    ).first()
                    if variant is None:
                        variant = PronunciationVariant.objects.create(
                            entry=entry,
                            dialect=dialect,
                            ipa=ipa,
                            surface_romanization=romanization,
                            reading_type=PronunciationVariant.ReadingType.GENERAL,
                            status=(
                                PronunciationVariant.Status.REVIEWED
                                if verifier
                                else PronunciationVariant.Status.DRAFT
                            ),
                            created_by=recorder,
                        )
                        variant_created = True

                link = RecordingEntryLink.objects.create(
                    recording=recording,
                    entry=entry,
                    role=RecordingEntryLink.Role.PRIMARY,
                    status=RecordingEntryLink.Status.ACCEPTED,
                    created_by=recorder,
                    reviewed_by=verifier,
                    review_reason=(
                        "旧库审核状态迁移" if verifier else "原贡献者初始主词条"
                    ),
                    reviewed_at=upload_time if verifier else None,
                )
                evidence = EvidenceRecord.objects.create(
                    source_type=EvidenceRecord.SourceType.LEGACY,
                    original_text=str(word_row["definition"] or ""),
                    original_writing=str(word_row["word"] or ""),
                    original_gloss=str(word_row["definition"] or ""),
                    original_pronunciation=(original_romanization or original_ipa),
                    citation=str(row["source"] or "")[:500],
                    source_metadata={
                        "system": SOURCE_SYSTEM,
                        "table": "word_pronunciation",
                        "id": row["id"],
                        "word_id": row["word_id"],
                        "ipa": original_ipa,
                        "pinyin": original_romanization,
                        "county": str(row["county"] or ""),
                        "town": str(row["town"] or ""),
                        "visibility": bool(row["visibility"]),
                        "views": max(0, int(row["views"] or 0)),
                        "location_mapping": location["reason"],
                        "verifier_id": row["verifier_id"],
                        "upload_time": str(row["upload_time"] or ""),
                    },
                    contributor=recorder,
                )
                evidence_links = [
                    EvidenceLink.objects.create(
                        evidence=evidence,
                        recording=recording,
                        relation_type=EvidenceLink.RelationType.SUBMITTED,
                        created_by=recorder,
                    ),
                    EvidenceLink.objects.create(
                        evidence=evidence,
                        recording_entry_link=link,
                        relation_type=EvidenceLink.RelationType.SUBMITTED,
                        created_by=recorder,
                    ),
                ]
                if variant:
                    evidence_links.append(
                        EvidenceLink.objects.create(
                            evidence=evidence,
                            pronunciation_variant=variant,
                            relation_type=EvidenceLink.RelationType.SUBMITTED,
                            created_by=recorder,
                        )
                    )
                if upload_time:
                    Recording.objects.filter(pk=recording.pk).update(
                        created_at=upload_time,
                        updated_at=upload_time,
                    )
                    EvidenceRecord.objects.filter(pk=evidence.pk).update(
                        created_at=upload_time
                    )
                self._record_ledger(
                    "word_pronunciation",
                    row,
                    recording,
                    metadata={
                        "entry_id": entry.id,
                        "recording_entry_link_id": link.id,
                        "pronunciation_variant_id": variant.id if variant else None,
                        "evidence_record_id": evidence.id,
                        "evidence_link_ids": [item.id for item in evidence_links],
                    },
                )
            self.report["created"]["v2_recordings"] += 1
            self.report["created"]["v2_recording_entry_links"] += 1
            self.report["created"]["v2_recorded_variants"] += int(variant_created)
            self.report["created"]["v2_evidence_records"] += 1

    def import_review_candidates_v2(self):
        """Persist review suggestions only after their Entries exist."""

        for item in self.review_candidates:
            entry_pairs = []
            for source_id in item["source_word_ids"]:
                ledger = self._ledger(
                    "word_word",
                    source_id,
                    target_model=Entry._meta.label,
                )
                entry = (
                    Entry.objects.filter(pk=ledger.target_id).first()
                    if ledger
                    else None
                )
                if entry:
                    entry_pairs.append((source_id, entry))
            if len(entry_pairs) != len(item["source_word_ids"]):
                self.report["skipped"]["v2_review_candidates_unmapped"] += 1
                continue

            fingerprint = payload_fingerprint(item)
            existing = LegacyReviewCandidate.objects.filter(
                source_system=SOURCE_SYSTEM,
                candidate_type=item["candidate_type"],
                candidate_key=item["candidate_key"],
            ).first()
            if existing:
                if existing.fingerprint != fingerprint:
                    self.report["conflicts"].append(
                        {
                            "candidate_type": item["candidate_type"],
                            "candidate_key": item["candidate_key"],
                            "reason": "candidate_source_changed_after_import",
                        }
                    )
                else:
                    self.report["skipped"]["v2_review_candidates"] += 1
                continue

            entries = [entry for _, entry in entry_pairs]
            with transaction.atomic():
                candidate = LegacyReviewCandidate.objects.create(
                    source_system=SOURCE_SYSTEM,
                    candidate_key=item["candidate_key"],
                    candidate_type=item["candidate_type"],
                    primary_entry=entries[0] if entries else None,
                    source_ids=item["source_word_ids"],
                    payload=item["payload"],
                    fingerprint=fingerprint,
                )
                candidate.entries.set(entries)
            self.report["created"]["v2_review_candidates"] += 1

    def run(self):
        self.analyze()
        if not self.apply:
            return self.final_report()
        self.import_users()
        self.import_entries_v2()
        self.import_recordings_v2()
        self.import_review_candidates_v2()
        return self.final_report()

    def final_report(self):
        report = dict(self.report)
        for key in ("created", "skipped", "normalized", "unknown_locations"):
            report[key] = dict(report[key])
        ledger_actions = defaultdict(lambda: defaultdict(int))
        for item in (
            LegacyImportRecord.objects.filter(source_system=SOURCE_SYSTEM)
            .values("source_table", "action")
            .annotate(count=models.Count("id"))
        ):
            ledger_actions[item["source_table"]][item["action"]] = item["count"]
        report["ledger_actions"] = {
            table: dict(actions) for table, actions in ledger_actions.items()
        }
        report["database_counts"] = {
            "users": User.objects.count(),
            "entries": Entry.objects.count(),
            "senses": EntrySense.objects.count(),
            "writings": WritingForm.objects.count(),
            "pronunciation_variants": PronunciationVariant.objects.count(),
            "recordings": Recording.objects.count(),
            "recording_entry_links": RecordingEntryLink.objects.count(),
            "evidence_records": EvidenceRecord.objects.count(),
            "review_candidates": LegacyReviewCandidate.objects.count(),
            "legacy_import_records": LegacyImportRecord.objects.filter(
                source_system=SOURCE_SYSTEM
            ).count(),
        }
        return report


def _export_demo_fixture_v1_retired():
    """Export five public recordings without database or identity keys."""
    selected = []
    for qualified_code in DEMO_DIALECT_CODES:
        dialect = resolve_dialect(qualified_code)
        if dialect is None:
            raise ValueError(f"缺少方言节点: {qualified_code}")
        can = (
            Can.objects.filter(
                visibility=True,
                submitted_dialect=dialect,
                nameplates__is_primary=True,
                nameplates__status=Nameplate.Status.ACTIVE,
            )
            .select_related("recorder", "verifier", "submitted_dialect")
            .distinct()
            .order_by("id")
            .first()
        )
        if can is None or can.primary_nameplate is None:
            raise ValueError(f"没有可导出的公开录音: {qualified_code}")
        selected.append((qualified_code, can, can.primary_nameplate))

    user_ids = sorted(
        {
            user_id
            for _, can, nameplate in selected
            for user_id in (can.recorder_id, can.verifier_id, nameplate.creator_id)
            if user_id
        }
    )
    actor_keys = {
        user_id: f"actor_{index}" for index, user_id in enumerate(user_ids, 1)
    }
    actors = [
        {"key": key, "display_name": f"示例贡献者{index}", "role": "contributor"}
        for index, key in enumerate(actor_keys.values(), 1)
    ]
    entries = []
    for index, (qualified_code, can, nameplate) in enumerate(selected, 1):
        pronunciation = nameplate.pronunciation
        entries.append(
            {
                "key": f"entry_{index}",
                "dialect": qualified_code,
                "package": {
                    "text": nameplate.package.text,
                    "package_type": nameplate.package.package_type,
                },
                "flavor": {
                    "name": nameplate.flavor.name,
                    "definition": nameplate.flavor.definition,
                    "mandarin": list(nameplate.flavor.mandarin or []),
                    "tags": list(nameplate.flavor.tags or []),
                    "visibility": bool(nameplate.flavor.visibility),
                },
                "pronunciation": {
                    "ipa": pronunciation.ipa if pronunciation else "",
                    "surface_romanization": (
                        pronunciation.surface_romanization if pronunciation else ""
                    ),
                    "reading_type": (
                        pronunciation.reading_type
                        if pronunciation
                        else Pronunciation.ReadingType.GENERAL
                    ),
                    "status": (
                        pronunciation.status
                        if pronunciation
                        else Pronunciation.Status.DRAFT
                    ),
                },
                "can": {
                    "audio_url": can.audio_url,
                    "concept_text": can.concept_text,
                    "status": can.status,
                    "visibility": bool(can.visibility),
                    "recorder": actor_keys.get(can.recorder_id),
                    "verifier": actor_keys.get(can.verifier_id),
                },
                "nameplate": {
                    "creator": actor_keys.get(nameplate.creator_id),
                    "text_content": nameplate.text_content,
                    "definition": nameplate.definition,
                    "pronunciation_text": nameplate.pronunciation_text,
                    "evidence_level": nameplate.evidence_level,
                    "weight": nameplate.weight,
                },
            }
        )
    return {
        "schema_version": 1,
        "format": "guantou-logical-key-demo",
        "actors": actors,
        "entries": entries,
    }


def _validate_demo_fixture_v1_retired(payload):
    if (
        payload.get("schema_version") != 1
        or payload.get("format") != "guantou-logical-key-demo"
    ):
        raise ValueError("不支持的 demo fixture 格式")
    actors = payload.get("actors")
    entries = payload.get("entries")
    if not isinstance(actors, list) or not isinstance(entries, list):
        raise ValueError("demo fixture 缺少 actors 或 entries")
    actor_keys = {actor.get("key") for actor in actors if isinstance(actor, dict)}
    if None in actor_keys or len(actor_keys) != len(actors):
        raise ValueError("demo fixture actor key 无效或重复")
    entry_keys = set()
    for entry in entries:
        if not isinstance(entry, dict) or not entry.get("key"):
            raise ValueError("demo fixture entry key 无效")
        if entry["key"] in entry_keys:
            raise ValueError("demo fixture entry key 重复")
        entry_keys.add(entry["key"])
        if resolve_dialect(entry.get("dialect")) is None:
            raise ValueError(f"demo fixture 方言不存在: {entry.get('dialect')}")
        for field in ("package", "flavor", "pronunciation", "can", "nameplate"):
            if not isinstance(entry.get(field), dict):
                raise ValueError(f"demo fixture 条目缺少 {field}")
        for actor_field in (
            entry["can"].get("recorder"),
            entry["can"].get("verifier"),
            entry["nameplate"].get("creator"),
        ):
            if actor_field is not None and actor_field not in actor_keys:
                raise ValueError(f"demo fixture 引用了未知 actor: {actor_field}")
    return actors, entries


def _import_demo_fixture_v1_retired(payload, *, apply=False):
    """Validate or idempotently load the sanitized logical-key fixture."""
    actors, entries = _validate_demo_fixture_v1_retired(payload)
    report = {
        "mode": "apply" if apply else "dry-run",
        "format": payload["format"],
        "source_counts": {"actors": len(actors), "entries": len(entries)},
        "created": defaultdict(int),
        "skipped": defaultdict(int),
    }
    if not apply:
        return {**report, "created": {}, "skipped": {}}

    actor_map = {}
    with transaction.atomic():
        for actor in actors:
            username = f"hinghwa_demo_{actor['key']}"
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "first_name": "",
                    "last_name": "",
                    "email": "",
                    "is_staff": False,
                    "is_superuser": False,
                    "is_active": True,
                },
            )
            if created:
                user.set_unusable_password()
                user.save(update_fields=["password"])
                UserInfo.objects.create(
                    user=user,
                    nickname=str(actor.get("display_name") or actor["key"])[:100],
                )
                report["created"]["actors"] += 1
            else:
                UserInfo.objects.get_or_create(user=user)
                report["skipped"]["actors"] += 1
            actor_map[actor["key"]] = user

        for entry in entries:
            entry_key = entry["key"]
            existing = Can.objects.filter(metadata__demo_fixture_key=entry_key).first()
            if existing:
                report["skipped"]["entries"] += 1
                continue
            dialect = resolve_dialect(entry["dialect"])
            package_data = entry["package"]
            package, package_created = Package.objects.get_or_create(
                text=package_data["text"],
                package_type=package_data["package_type"],
                defaults={"metadata": {"demo_fixture_keys": [entry_key]}},
            )
            if not package_created:
                metadata = dict(package.metadata or {})
                keys = list(metadata.get("demo_fixture_keys", []))
                if entry_key not in keys:
                    keys.append(entry_key)
                    metadata["demo_fixture_keys"] = keys
                    package.metadata = metadata
                    package.save(update_fields=["metadata", "updated_at"])
            flavor_data = entry["flavor"]
            flavor = Flavor.objects.create(
                name=flavor_data["name"],
                definition=flavor_data["definition"],
                mandarin=list(flavor_data.get("mandarin") or []),
                tags=list(flavor_data.get("tags") or []),
                metadata={"demo_fixture_key": entry_key},
                visibility=bool(flavor_data.get("visibility", True)),
                created_by=actor_map.get(entry["can"].get("recorder")),
            )
            FlavorPackage.objects.create(
                flavor=flavor,
                package=package,
                mapping_type=FlavorPackage.MappingType.PRIMARY,
                note="脱敏 demo fixture",
            )
            pronunciation_data = entry["pronunciation"]
            pronunciation = Pronunciation.objects.create(
                flavor=flavor,
                package=package,
                dialect=dialect,
                ipa=str(pronunciation_data.get("ipa") or ""),
                surface_romanization=str(
                    pronunciation_data.get("surface_romanization") or ""
                ),
                reading_type=pronunciation_data.get("reading_type")
                or Pronunciation.ReadingType.GENERAL,
                status=pronunciation_data.get("status") or Pronunciation.Status.DRAFT,
                source_citation=f"demo-fixture:{entry_key}",
                created_by=actor_map.get(entry["can"].get("recorder")),
            )
            can_data = entry["can"]
            can = Can.objects.create(
                audio_url=can_data["audio_url"],
                recorder=actor_map.get(can_data.get("recorder")),
                submitted_dialect=dialect,
                concept_text=str(can_data.get("concept_text") or "")[:200],
                source_note="脱敏逻辑键 demo fixture",
                status=can_data.get("status") or Can.Status.PENDING,
                visibility=bool(can_data.get("visibility", True)),
                verifier=actor_map.get(can_data.get("verifier")),
                metadata={"demo_fixture_key": entry_key},
            )
            nameplate_data = entry["nameplate"]
            Nameplate.objects.create(
                can=can,
                flavor=flavor,
                package=package,
                dialect=dialect,
                pronunciation=pronunciation,
                creator=actor_map.get(nameplate_data.get("creator")),
                text_content=nameplate_data.get("text_content") or package.text,
                definition=nameplate_data.get("definition") or flavor.definition,
                pronunciation_text=nameplate_data.get("pronunciation_text") or "",
                evidence_level=nameplate_data.get("evidence_level")
                or Nameplate.EvidenceLevel.COMMUNITY,
                source={"type": Nameplate.SourceType.ARCHIVE, "fixture": entry_key},
                status=Nameplate.Status.ACTIVE,
                weight=max(0, int(nameplate_data.get("weight") or 0)),
                is_primary=True,
            )
            report["created"]["entries"] += 1
            report["created"]["packages"] += int(package_created)

        writing_type_map = {
            Package.PackageType.ORTHODOX: WritingForm.FormType.ORTHOGRAPHIC,
            Package.PackageType.LOAN: WritingForm.FormType.LOAN,
            Package.PackageType.POPULAR: WritingForm.FormType.POPULAR,
            Package.PackageType.PHONETIC: WritingForm.FormType.PHONETIC,
            Package.PackageType.ROMANIZATION: WritingForm.FormType.ROMANIZATION,
            Package.PackageType.UNCERTAIN: WritingForm.FormType.UNCERTAIN,
        }
        for fixture_entry in entries:
            entry_key = fixture_entry["key"]
            if Entry.objects.filter(metadata__demo_fixture_key=entry_key).exists():
                report["skipped"]["v2_entries"] += 1
                continue
            dialect = resolve_dialect(fixture_entry["dialect"])
            can_data = fixture_entry["can"]
            flavor_data = fixture_entry["flavor"]
            package_data = fixture_entry["package"]
            pronunciation_data = fixture_entry["pronunciation"]
            recorder = actor_map.get(can_data.get("recorder"))
            verifier = actor_map.get(can_data.get("verifier"))
            with transaction.atomic():
                v2_entry = Entry.objects.create(
                    summary=str(flavor_data.get("definition") or ""),
                    usage_dialect=dialect,
                    created_by=recorder,
                    visibility=bool(flavor_data.get("visibility", True)),
                    metadata={"demo_fixture_key": entry_key},
                )
                sense = EntrySense.objects.create(
                    entry=v2_entry,
                    gloss=str(flavor_data.get("definition") or ""),
                    created_by=recorder,
                )
                writing = WritingForm.objects.create(
                    text=str(package_data.get("text") or ""),
                    normalized_text=str(package_data.get("text") or ""),
                    form_type=writing_type_map.get(
                        package_data.get("package_type"),
                        WritingForm.FormType.UNCERTAIN,
                    ),
                    metadata={"demo_fixture_key": entry_key},
                )
                EntryWriting.objects.create(
                    entry=v2_entry,
                    writing=writing,
                    relation_type=EntryWriting.RelationType.PRIMARY,
                    created_by=recorder,
                    note="脱敏 demo fixture",
                )
                ipa = str(pronunciation_data.get("ipa") or "")
                romanization = str(pronunciation_data.get("surface_romanization") or "")
                variant = None
                if ipa or romanization:
                    variant = PronunciationVariant.objects.create(
                        entry=v2_entry,
                        dialect=dialect,
                        ipa=ipa,
                        surface_romanization=romanization,
                        reading_type=(
                            pronunciation_data.get("reading_type")
                            or PronunciationVariant.ReadingType.GENERAL
                        ),
                        status=(
                            PronunciationVariant.Status.REVIEWED
                            if pronunciation_data.get("status")
                            == Pronunciation.Status.VERIFIED
                            else PronunciationVariant.Status.DRAFT
                        ),
                        created_by=recorder,
                    )
                recording = Recording.objects.create(
                    audio_url=can_data["audio_url"],
                    usage_dialect=dialect,
                    recorder=recorder,
                    original_gloss=str(
                        can_data.get("concept_text")
                        or flavor_data.get("definition")
                        or ""
                    ),
                    status=(
                        Recording.Status.PUBLISHED
                        if can_data.get("visibility", True)
                        else Recording.Status.DRAFT
                    ),
                    visibility=bool(can_data.get("visibility", True)),
                    metadata={"demo_fixture_key": entry_key},
                )
                recording_link = RecordingEntryLink.objects.create(
                    recording=recording,
                    entry=v2_entry,
                    role=RecordingEntryLink.Role.PRIMARY,
                    status=RecordingEntryLink.Status.ACCEPTED,
                    created_by=recorder,
                    reviewed_by=verifier,
                    review_reason="脱敏 demo fixture",
                    reviewed_at=timezone.now() if verifier else None,
                )
                evidence = EvidenceRecord.objects.create(
                    source_type=EvidenceRecord.SourceType.OTHER,
                    original_writing=writing.text,
                    original_gloss=str(flavor_data.get("definition") or ""),
                    original_pronunciation=romanization or ipa,
                    citation=f"demo-fixture:{entry_key}",
                    source_metadata={"demo_fixture_key": entry_key},
                    contributor=recorder,
                )
                EvidenceLink.objects.create(evidence=evidence, entry=v2_entry)
                EvidenceLink.objects.create(evidence=evidence, sense=sense)
                EvidenceLink.objects.create(evidence=evidence, recording=recording)
                EvidenceLink.objects.create(
                    evidence=evidence,
                    recording_entry_link=recording_link,
                )
                if variant:
                    EvidenceLink.objects.create(
                        evidence=evidence,
                        pronunciation_variant=variant,
                    )
            report["created"]["v2_entries"] += 1
            report["created"]["v2_recordings"] += 1
    report["created"] = dict(report["created"])
    report["skipped"] = dict(report["skipped"])
    return report


def export_demo_fixture():
    """Export five V2 Entry/Recording examples using logical, anonymous keys."""
    selected = []
    for qualified_code in DEMO_DIALECT_CODES:
        dialect = resolve_dialect(qualified_code)
        if dialect is None:
            raise ValueError(f"缺少方言节点: {qualified_code}")
        recording = (
            Recording.objects.filter(
                visibility=True,
                usage_dialect=dialect,
                entry_links__is_current=True,
                entry_links__role=RecordingEntryLink.Role.PRIMARY,
            )
            .exclude(entry_links__status=RecordingEntryLink.Status.REJECTED)
            .select_related("recorder", "usage_dialect")
            .prefetch_related(
                "entry_links__entry__entry_writings__writing",
                "entry_links__entry__senses",
                "entry_links__entry__pronunciation_variants",
            )
            .distinct()
            .order_by("id")
            .first()
        )
        if recording is None:
            raise ValueError(f"没有可导出的公开录音: {qualified_code}")
        link = next(
            (
                item
                for item in recording.entry_links.all()
                if item.is_current
                and item.role == RecordingEntryLink.Role.PRIMARY
                and item.status != RecordingEntryLink.Status.REJECTED
            ),
            None,
        )
        if link is None:
            raise ValueError(f"录音缺少主要词条关系: {qualified_code}")
        selected.append((qualified_code, recording, link))

    user_ids = sorted(
        {
            user_id
            for _, recording, link in selected
            for user_id in (
                recording.recorder_id,
                link.entry.created_by_id,
                link.created_by_id,
                link.reviewed_by_id,
            )
            if user_id
        }
    )
    actor_keys = {
        user_id: f"actor_{index}" for index, user_id in enumerate(user_ids, 1)
    }
    actors = [
        {"key": key, "display_name": f"示例贡献者{index}", "role": "contributor"}
        for index, key in enumerate(actor_keys.values(), 1)
    ]
    items = []
    for index, (qualified_code, recording, link) in enumerate(selected, 1):
        entry = link.entry
        writing_link = next(
            (
                item
                for item in entry.entry_writings.all()
                if item.is_current
                and item.status != EntryWriting.Status.REJECTED
                and item.relation_type == EntryWriting.RelationType.PRIMARY
            ),
            None,
        )
        sense = next(iter(entry.senses.all()), None)
        variant = next(iter(entry.pronunciation_variants.all()), None)
        items.append(
            {
                "key": f"entry_recording_{index}",
                "dialect": qualified_code,
                "entry": {
                    "summary": entry.summary,
                    "identity_note": entry.identity_note,
                    "status": entry.status,
                    "visibility": bool(entry.visibility),
                    "creator": actor_keys.get(entry.created_by_id),
                    "writing": (
                        {
                            "text": writing_link.writing.text,
                            "form_type": writing_link.writing.form_type,
                        }
                        if writing_link
                        else None
                    ),
                    "sense": (
                        {
                            "gloss": sense.gloss,
                            "usage_note": sense.usage_note,
                            "examples": list(sense.examples or []),
                            "status": sense.status,
                        }
                        if sense
                        else None
                    ),
                    "pronunciation": (
                        {
                            "ipa": variant.ipa,
                            "base_romanization": variant.base_romanization,
                            "surface_romanization": variant.surface_romanization,
                            "reading_type": variant.reading_type,
                            "status": variant.status,
                        }
                        if variant
                        else None
                    ),
                },
                "recording": {
                    "audio_url": recording.audio_url,
                    "recording_type": recording.recording_type,
                    "original_gloss": recording.original_gloss,
                    "duration_ms": recording.duration_ms,
                    "rights_statement": recording.rights_statement,
                    "status": recording.status,
                    "visibility": bool(recording.visibility),
                    "recorder": actor_keys.get(recording.recorder_id),
                },
                "link": {
                    "role": link.role,
                    "status": link.status,
                    "creator": actor_keys.get(link.created_by_id),
                    "reviewer": actor_keys.get(link.reviewed_by_id),
                    "review_reason": link.review_reason,
                },
            }
        )
    return {
        "schema_version": 2,
        "format": "guantou-entry-recording-demo",
        "actors": actors,
        "items": items,
    }


def _validate_demo_fixture(payload):
    if (
        payload.get("schema_version") != 2
        or payload.get("format") != "guantou-entry-recording-demo"
    ):
        raise ValueError("不支持的 demo fixture 格式；请导出 Entry/Recording V2 格式")
    actors = payload.get("actors")
    items = payload.get("items")
    if not isinstance(actors, list) or not isinstance(items, list):
        raise ValueError("demo fixture 缺少 actors 或 items")
    actor_keys = {actor.get("key") for actor in actors if isinstance(actor, dict)}
    if None in actor_keys or len(actor_keys) != len(actors):
        raise ValueError("demo fixture actor key 无效或重复")
    item_keys = set()
    for item in items:
        if not isinstance(item, dict) or not item.get("key"):
            raise ValueError("demo fixture item key 无效")
        if item["key"] in item_keys:
            raise ValueError("demo fixture item key 重复")
        item_keys.add(item["key"])
        if resolve_dialect(item.get("dialect")) is None:
            raise ValueError(f"demo fixture 方言不存在: {item.get('dialect')}")
        for field in ("entry", "recording", "link"):
            if not isinstance(item.get(field), dict):
                raise ValueError(f"demo fixture item 缺少 {field}")
        references = (
            item["entry"].get("creator"),
            item["recording"].get("recorder"),
            item["link"].get("creator"),
            item["link"].get("reviewer"),
        )
        if any(key is not None and key not in actor_keys for key in references):
            raise ValueError("demo fixture 引用了未知 actor")
    return actors, items


def import_demo_fixture(payload, *, apply=False):
    """Validate or idempotently load a sanitized Entry/Recording V2 fixture."""
    actors, items = _validate_demo_fixture(payload)
    report = {
        "mode": "apply" if apply else "dry-run",
        "format": payload["format"],
        "source_counts": {"actors": len(actors), "items": len(items)},
        "created": defaultdict(int),
        "skipped": defaultdict(int),
    }
    if not apply:
        return {**report, "created": {}, "skipped": {}}

    actor_map = {}
    with transaction.atomic():
        for actor in actors:
            username = f"hinghwa_demo_{actor['key']}"
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": "",
                    "is_staff": False,
                    "is_superuser": False,
                    "is_active": True,
                },
            )
            if created:
                user.set_unusable_password()
                user.save(update_fields=["password"])
                UserInfo.objects.create(
                    user=user,
                    nickname=str(actor.get("display_name") or actor["key"])[:100],
                )
                report["created"]["actors"] += 1
            else:
                UserInfo.objects.get_or_create(user=user)
                report["skipped"]["actors"] += 1
            actor_map[actor["key"]] = user

        for item in items:
            fixture_key = item["key"]
            if Entry.objects.filter(metadata__demo_fixture_key=fixture_key).exists():
                report["skipped"]["items"] += 1
                continue
            dialect = resolve_dialect(item["dialect"])
            entry_data = item["entry"]
            recording_data = item["recording"]
            link_data = item["link"]
            creator = actor_map.get(entry_data.get("creator"))
            recorder = actor_map.get(recording_data.get("recorder"))
            entry = Entry.objects.create(
                summary=str(entry_data.get("summary") or ""),
                identity_note=str(entry_data.get("identity_note") or "")[:240],
                usage_dialect=dialect,
                status=entry_data.get("status") or Entry.Status.DRAFT,
                visibility=bool(entry_data.get("visibility", True)),
                created_by=creator,
                metadata={"demo_fixture_key": fixture_key},
            )
            writing_data = entry_data.get("writing")
            if writing_data:
                writing = WritingForm.objects.create(
                    text=str(writing_data.get("text") or ""),
                    normalized_text=str(writing_data.get("text") or ""),
                    form_type=writing_data.get("form_type")
                    or WritingForm.FormType.UNCERTAIN,
                    metadata={"demo_fixture_key": fixture_key},
                )
                EntryWriting.objects.create(
                    entry=entry,
                    writing=writing,
                    relation_type=EntryWriting.RelationType.PRIMARY,
                    created_by=creator,
                    note="脱敏 Entry/Recording demo fixture",
                )
            sense = None
            sense_data = entry_data.get("sense")
            if sense_data:
                sense = EntrySense.objects.create(
                    entry=entry,
                    gloss=str(sense_data.get("gloss") or ""),
                    usage_note=str(sense_data.get("usage_note") or ""),
                    examples=list(sense_data.get("examples") or []),
                    status=sense_data.get("status") or EntrySense.Status.DRAFT,
                    created_by=creator,
                )
            variant = None
            pronunciation_data = entry_data.get("pronunciation")
            if pronunciation_data:
                variant = PronunciationVariant.objects.create(
                    entry=entry,
                    dialect=dialect,
                    ipa=str(pronunciation_data.get("ipa") or ""),
                    base_romanization=str(
                        pronunciation_data.get("base_romanization") or ""
                    ),
                    surface_romanization=str(
                        pronunciation_data.get("surface_romanization") or ""
                    ),
                    reading_type=pronunciation_data.get("reading_type")
                    or PronunciationVariant.ReadingType.GENERAL,
                    status=pronunciation_data.get("status")
                    or PronunciationVariant.Status.DRAFT,
                    created_by=creator,
                )
            recording = Recording.objects.create(
                audio_url=recording_data["audio_url"],
                usage_dialect=dialect,
                recorder=recorder,
                recording_type=recording_data.get("recording_type")
                or Recording.RecordingType.WORD,
                original_gloss=str(recording_data.get("original_gloss") or ""),
                duration_ms=max(0, int(recording_data.get("duration_ms") or 0)),
                rights_statement=str(recording_data.get("rights_statement") or "")[
                    :300
                ],
                status=recording_data.get("status") or Recording.Status.DRAFT,
                visibility=bool(recording_data.get("visibility", True)),
                metadata={"demo_fixture_key": fixture_key},
            )
            link = RecordingEntryLink.objects.create(
                recording=recording,
                entry=entry,
                sense=sense,
                role=link_data.get("role") or RecordingEntryLink.Role.PRIMARY,
                status=link_data.get("status") or RecordingEntryLink.Status.SUGGESTED,
                created_by=actor_map.get(link_data.get("creator")),
                reviewed_by=actor_map.get(link_data.get("reviewer")),
                review_reason=str(link_data.get("review_reason") or "")[:300],
                reviewed_at=(
                    timezone.now() if link_data.get("reviewer") is not None else None
                ),
            )
            evidence = EvidenceRecord.objects.create(
                source_type=EvidenceRecord.SourceType.OTHER,
                original_writing=str((writing_data or {}).get("text") or ""),
                original_gloss=str(
                    (sense_data or {}).get("gloss")
                    or recording_data.get("original_gloss")
                    or ""
                ),
                original_pronunciation=str(
                    (pronunciation_data or {}).get("surface_romanization")
                    or (pronunciation_data or {}).get("ipa")
                    or ""
                ),
                citation=f"demo-fixture:{fixture_key}",
                source_metadata={"demo_fixture_key": fixture_key},
                contributor=recorder or creator,
            )
            EvidenceLink.objects.create(evidence=evidence, entry=entry)
            if sense:
                EvidenceLink.objects.create(evidence=evidence, sense=sense)
            EvidenceLink.objects.create(evidence=evidence, recording=recording)
            EvidenceLink.objects.create(evidence=evidence, recording_entry_link=link)
            if variant:
                EvidenceLink.objects.create(
                    evidence=evidence, pronunciation_variant=variant
                )
            report["created"]["items"] += 1
            report["created"]["entries"] += 1
            report["created"]["recordings"] += 1
    report["created"] = dict(report["created"])
    report["skipped"] = dict(report["skipped"])
    return report
