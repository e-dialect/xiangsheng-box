from .models import Notification

from user.dto.user_simple import user_simple


def notification_normal(notification: Notification) -> dict:
    metadata = notification.metadata or {}
    target = {
        "type": metadata.get("target_type", ""),
        "id": metadata.get("target_id"),
        "url": metadata.get("target_url", ""),
        # Discussion anchors let the client reopen the exact comment thread.
        "comment_id": metadata.get("comment_id"),
        "root_id": metadata.get("root_id"),
        "anchor": metadata.get("anchor", ""),
    }
    return {
        "id": notification.id,
        "from": user_simple(notification.actor),
        "to": user_simple(notification.recipient),
        "time": notification.timestamp.__format__("%Y-%m-%d %H:%M:%S"),
        "title": metadata.get("title") or notification.display_title,
        "verb": notification.verb,
        "unread": notification.unread,
        "content": notification.description,
        "public": notification.public,
        "target": target,
    }
