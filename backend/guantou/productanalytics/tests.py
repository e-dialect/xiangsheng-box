from datetime import timedelta
from unittest.mock import patch

from django.db import OperationalError
from django.test import Client, TestCase, override_settings
from django.core.cache import cache
from django.utils import timezone

from .models import ProductEvent, ProductEventDailySummary
from .services import (
    aggregate_and_prune_product_events,
    daily_session_hash,
    maybe_maintain_product_events,
)


class ProductEventApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = Client()
        self.payload = {
            "session_id": "session-12345678",
            "event_name": "entry_search",
            "platform": "h5",
            "surface": "search",
            "result": "success",
            "metadata": {"result_bucket": "1-5", "filter_count": 2},
        }

    def test_accepts_privacy_minimized_event_without_storing_session_id(self):
        response = self.client.post(
            "/product-events/", self.payload, content_type="application/json"
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json(), {"accepted": 1})
        event = ProductEvent.objects.get()
        self.assertEqual(event.event_name, "entry_search")
        self.assertEqual(event.platform, "h5")
        self.assertEqual(event.metadata, {"result_bucket": "1-5", "filter_count": 2})
        self.assertNotEqual(event.session_hash, self.payload["session_id"])
        self.assertNotIn(self.payload["session_id"], str(event.__dict__))

    def test_rejects_content_identifiers_and_free_text_metadata(self):
        for forbidden in (
            {"query": "银行"},
            {"entry_id": 123},
            {"dialect_code": "闽.莆仙.莆田"},
            {"user_id": 7},
        ):
            with self.subTest(forbidden=forbidden):
                payload = {**self.payload, "metadata": forbidden}
                response = self.client.post(
                    "/product-events/", payload, content_type="application/json"
                )
                self.assertEqual(response.status_code, 400)
        self.assertFalse(ProductEvent.objects.exists())

    def test_rejects_free_text_surface(self):
        response = self.client.post(
            "/product-events/",
            {**self.payload, "surface": "private_note"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(ProductEvent.objects.exists())

    def test_accepts_a_bounded_batch(self):
        response = self.client.post(
            "/product-events/",
            {"events": [self.payload, {**self.payload, "result": "empty"}]},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json(), {"accepted": 2})

        response = self.client.post(
            "/product-events/",
            {"events": [self.payload] * 51},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_rate_limit_counts_events_inside_batches(self):
        for _ in range(2):
            response = self.client.post(
                "/product-events/",
                {"events": [self.payload] * 50},
                content_type="application/json",
            )
            self.assertEqual(response.status_code, 202)

        response = self.client.post(
            "/product-events/",
            {"events": [self.payload] * 50},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 429)
        self.assertEqual(ProductEvent.objects.count(), 100)


class ProductEventRetentionTests(TestCase):
    def create_at(self, *, received_at, session_hash):
        event = ProductEvent.objects.create(
            event_name="listen_feed_view",
            session_hash=session_hash,
            platform="h5",
            surface="listen",
            result="view",
            metadata={"tab": "today"},
        )
        ProductEvent.objects.filter(pk=event.pk).update(received_at=received_at)
        return event

    @override_settings(PRODUCT_EVENT_RETENTION_DAYS=90)
    def test_aggregates_complete_days_and_prunes_only_expired_raw_detail(self):
        now = timezone.now()
        expired = now - timedelta(days=91)
        yesterday = now - timedelta(days=1)
        self.create_at(received_at=expired, session_hash="expired-session")
        self.create_at(received_at=yesterday, session_hash="shared-session")
        self.create_at(received_at=yesterday, session_hash="shared-session")
        self.create_at(received_at=yesterday, session_hash="other-session")

        result = aggregate_and_prune_product_events(now=now)

        self.assertEqual(result["deleted_raw_events"], 1)
        self.assertEqual(ProductEvent.objects.count(), 3)
        summary = ProductEventDailySummary.objects.get(
            date=timezone.localdate(yesterday),
            event_name="listen_feed_view",
            platform="h5",
            surface="listen",
            result="view",
        )
        self.assertEqual(summary.event_count, 3)
        self.assertEqual(summary.unique_sessions, 2)
        self.assertTrue(
            ProductEventDailySummary.objects.filter(
                date=timezone.localdate(expired), event_count=1
            ).exists()
        )

        aggregate_and_prune_product_events(now=now)
        summary.refresh_from_db()
        self.assertEqual(summary.event_count, 3)
        self.assertEqual(summary.unique_sessions, 2)

    @override_settings(PRODUCT_EVENT_RETENTION_DAYS=365)
    def test_service_enforces_hard_ninety_day_maximum(self):
        now = timezone.now()
        self.create_at(received_at=now - timedelta(days=91), session_hash="old")

        aggregate_and_prune_product_events(now=now)

        self.assertFalse(ProductEvent.objects.exists())

    def test_session_hash_is_stable_only_within_one_calendar_day(self):
        now = timezone.now()
        session_id = "session-12345678"
        self.assertEqual(
            daily_session_hash(session_id, now), daily_session_hash(session_id, now)
        )
        self.assertNotEqual(
            daily_session_hash(session_id, now),
            daily_session_hash(session_id, now + timedelta(days=1)),
        )

    @patch(
        "productanalytics.services.aggregate_and_prune_product_events",
        side_effect=RuntimeError("temporary database lock"),
    )
    def test_opportunistic_maintenance_failure_never_breaks_event_ingestion(
        self, mocked
    ):
        cache.clear()

        self.assertIsNone(maybe_maintain_product_events())
        self.assertIsNone(maybe_maintain_product_events())

        self.assertEqual(mocked.call_count, 2)

    @patch(
        "productanalytics.services.aggregate_and_prune_product_events",
        side_effect=[
            OperationalError("database is locked"),
            {"summaries": 0, "deleted_raw_events": 0},
        ],
    )
    def test_opportunistic_maintenance_retries_transient_sqlite_lock(self, mocked):
        cache.clear()

        result = maybe_maintain_product_events()

        self.assertEqual(result, {"summaries": 0, "deleted_raw_events": 0})
        self.assertEqual(mocked.call_count, 2)
