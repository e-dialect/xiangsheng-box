"""Scope guards shared by ordinary updates and semantic decisions."""

from django.db.models import Q
from rest_framework import serializers

from .models import (
    CurationAction,
    Entry,
    EntrySense,
    EntryWriting,
    Recording,
    RecordingEntryLink,
)


def has_scope_decisions(instance, target_type):
    targets = Q(target_type=target_type, target_id=instance.pk)
    if isinstance(instance, Entry):
        senses = EntrySense.objects.filter(entry=instance)
        writings = EntryWriting.objects.filter(entry=instance)
        if (
            senses.exclude(status="draft").exists()
            or writings.exclude(status="draft").exists()
        ):
            return True
        targets |= Q(target_type="sense", target_id__in=senses.values("pk"))
        targets |= Q(target_type="writing", target_id__in=writings.values("pk"))
    elif isinstance(instance, Recording):
        # Historical versions carry decisions too, even when the successor is suggested.
        links = RecordingEntryLink.objects.filter(recording=instance)
        # These two server-generated accepted links are authorship, not review.
        authored = Q(
            status="accepted",
            created_by_id=instance.recorder_id,
            reviewed_at__isnull=True,
            reviewed_by__isnull=True,
            supersedes__isnull=True,
            review_reason__in=["录制者初始著录", "录制者补充关联"],
        )
        if links.filter(
            (~Q(status="suggested") & ~authored)
            | Q(reviewed_at__isnull=False)
            | Q(reviewed_by__isnull=False)
        ).exists():
            return True
        targets |= Q(target_type="recording_link", target_id__in=links.values("pk"))
    return CurationAction.objects.filter(targets).exists()


def lock_scope_child(model, target_id, parent_model, parent_field, **filters):
    """Inside atomic(): lock the scope owner before the child, then recheck ownership."""
    parent_id = model.objects.values_list(f"{parent_field}_id", flat=True).get(
        pk=target_id
    )
    parent_model.objects.select_for_update().get(pk=parent_id)
    child = model.objects.select_for_update(of=("self",)).get(pk=target_id, **filters)
    if getattr(child, f"{parent_field}_id") != parent_id:
        raise serializers.ValidationError(
            {"target_id": "对象所属范围已变化，请刷新后重试"}
        )
    return child
