from datetime import timedelta
import logging
import time

from django.conf import settings
from django.core.cache import cache
from django.db import OperationalError, transaction
from django.db.models import Count
from django.utils import timezone
from django.utils.crypto import salted_hmac

from .models import ProductEvent, ProductEventDailySummary

logger = logging.getLogger(__name__)


def _is_sqlite_lock(exc):
    return isinstance(exc, OperationalError) and "locked" in str(exc).lower()


def daily_session_hash(session_id, received_at=None):
    received_at = received_at or timezone.now()
    local_day = timezone.localdate(received_at)
    return salted_hmac(
        "product-event-session",
        f"{local_day.isoformat()}:{session_id}",
        secret=settings.SECRET_KEY,
    ).hexdigest()


def create_product_event(validated_data):
    data = dict(validated_data)
    session_id = data.pop("session_id")
    data["session_hash"] = daily_session_hash(session_id)
    return ProductEvent.objects.create(**data)


@transaction.atomic
def aggregate_and_prune_product_events(now=None):
    now = now or timezone.now()
    today = timezone.localdate(now)
    grouped = (
        ProductEvent.objects.filter(received_at__date__lt=today)
        .values("event_name", "platform", "surface", "result", "received_at__date")
        .annotate(
            event_count=Count("id"),
            unique_sessions=Count("session_hash", distinct=True),
        )
    )
    summary_count = 0
    for row in grouped.iterator():
        ProductEventDailySummary.objects.update_or_create(
            date=row["received_at__date"],
            event_name=row["event_name"],
            platform=row["platform"],
            surface=row["surface"],
            result=row["result"],
            defaults={
                "event_count": row["event_count"],
                "unique_sessions": row["unique_sessions"],
            },
        )
        summary_count += 1

    retention_days = min(int(settings.PRODUCT_EVENT_RETENTION_DAYS), 90)
    cutoff = now - timedelta(days=retention_days)
    deleted_count, _ = ProductEvent.objects.filter(received_at__lt=cutoff).delete()
    return {"summaries": summary_count, "deleted_raw_events": deleted_count}


def maybe_maintain_product_events(now=None):
    now = now or timezone.now()
    key = f"product-analytics-maintenance:{timezone.localdate(now).isoformat()}"
    if not cache.add(key, True, timeout=60 * 60 * 24):
        return None
    try:
        for attempt in range(3):
            try:
                return aggregate_and_prune_product_events(now=now)
            except OperationalError as exc:
                if not _is_sqlite_lock(exc) or attempt == 2:
                    raise
                time.sleep(0.05 * (attempt + 1))
    except Exception:
        cache.delete(key)
        logger.exception("Failed to aggregate and prune product events")
        return None
