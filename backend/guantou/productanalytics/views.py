from django.core.cache import cache
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import SHARE_RESULTS, ProductEventInputSerializer
from .services import (
    create_product_event,
    daily_session_hash,
    maybe_maintain_product_events,
    share_site,
)


def event_rate_limited(session_hash, increment):
    key = f"product-event-rate:{session_hash}"
    if cache.add(key, increment, timeout=60):
        return increment > 120
    try:
        return cache.incr(key, increment) > 120
    except ValueError:
        cache.set(key, increment, timeout=60)
        return increment > 120


class ProductEventView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        raw_events = (
            request.data.get("events") if isinstance(request.data, dict) else None
        )
        events = raw_events if raw_events is not None else [request.data]
        if not isinstance(events, list) or not events or len(events) > 50:
            return Response(
                {"events": ["每批必须包含 1 至 50 个事件"]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = ProductEventInputSerializer(data=events, many=True)
        serializer.is_valid(raise_exception=True)

        session_counts = {}
        for item in serializer.validated_data:
            session_hash = daily_session_hash(item["session_id"])
            session_counts[session_hash] = session_counts.get(session_hash, 0) + 1
        if any(
            event_rate_limited(session_hash, count)
            for session_hash, count in session_counts.items()
        ):
            return Response(
                {"detail": "事件提交过于频繁"},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        site = (
            share_site(request)
            if any(
                item["event_name"] in SHARE_RESULTS
                for item in serializer.validated_data
            )
            else ""
        )
        for item in serializer.validated_data:
            create_product_event(
                item, site=site if item["event_name"] in SHARE_RESULTS else ""
            )
        maybe_maintain_product_events()
        return Response({"accepted": len(events)}, status=status.HTTP_202_ACCEPTED)
