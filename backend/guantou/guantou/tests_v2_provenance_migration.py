"""Rehearse additive migration, old-code inserts, rollback and backup restore."""

from pathlib import Path
import sqlite3
from uuid import uuid4

from django.conf import settings
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class AuthoritySnapshotMigrationTests(TransactionTestCase):
    before = [("guantou", "0026_recordingcomment_reply_to")]
    after = [("guantou", "0027_curationaction_authority_snapshot")]

    def migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def test_legacy_unknown_old_writer_compatibility_and_recoverable_rollback(self):
        if connection.vendor != "sqlite":
            self.skipTest(
                "SQLite backup/restore rehearsal; production engine needs its own rehearsal"
            )
        backup_path = (
            Path(settings.BASE_DIR)
            / "migration-reports"
            / f"snapshot-{uuid4().hex}.sqlite3"
        )
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        backup = None
        try:
            old_apps = self.migrate(self.before)
            user = old_apps.get_model("auth", "User").objects.create(
                username="migration-actor"
            )
            old_action = old_apps.get_model("guantou", "CurationAction")
            legacy = old_action.objects.create(
                actor_id=user.id,
                action_type="review",
                target_type="entry",
                target_id=100,
                reason="Original historical reason",
            )
            new_apps = self.migrate(self.after)
            new_action = new_apps.get_model("guantou", "CurationAction")
            self.assertEqual(
                new_action.objects.get(pk=legacy.pk).authority_snapshot, {}
            )
            # A process running the previous model can still insert after the column is added.
            old_writer = old_action.objects.create(
                actor_id=user.id,
                action_type="review",
                target_type="entry",
                target_id=101,
                reason="Old writer after schema upgrade",
            )
            self.assertEqual(
                new_action.objects.get(pk=old_writer.pk).authority_snapshot, {}
            )
            captured = {"status": "captured", "mode": "grant", "grant_id": 7}
            new_action.objects.filter(pk=legacy.pk).update(authority_snapshot=captured)
            backup = sqlite3.connect(backup_path)
            connection.connection.backup(backup)
            self.migrate(self.before)
            self.assertEqual(old_action.objects.count(), 2)
            self.assertEqual(
                old_action.objects.get(pk=legacy.pk).reason,
                "Original historical reason",
            )
            new_apps = self.migrate(self.after)
            # Schema rollback drops the new column; only a backup restores its contents.
            self.assertEqual(
                new_apps.get_model("guantou", "CurationAction")
                .objects.get(pk=legacy.pk)
                .authority_snapshot,
                {},
            )
            backup.backup(connection.connection)
            from .models import CurationAction

            self.assertEqual(
                CurationAction.objects.get(pk=legacy.pk).authority_snapshot, captured
            )
            self.assertEqual(CurationAction.objects.count(), 2)
        finally:
            if backup is not None:
                backup.close()
            self.migrate(self.after)
            if backup_path.exists():
                backup_path.unlink()
