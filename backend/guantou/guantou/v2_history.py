"""Target-based history access; never infer access from a public grant alone."""

from django.db.models import CharField, Q
from django.db.models.fields.json import KeyTextTransform, KeyTransform
from django.db.models.functions import Cast
from rest_framework import permissions

from .models import (
    Entry,
    EntrySense,
    EntryWriting,
    LegacyReviewCandidate,
    PronunciationVariant,
    Recording,
    RecordingEntryLink,
)
from .v2_permissions import (
    active_curator_grants,
    is_lexical_curator,
    regional_curator_scope_ids,
)


class CurationHistoryPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return user.is_staff or active_curator_grants(user).exists()


def history_for_user(queryset, user, visible_entries, visible_recordings):
    if user.is_staff:
        return queryset
    # Compare text on both sides: PostgreSQL JSON values cannot be compared
    # directly with an integer subquery. Text also fails closed for malformed IDs.
    queryset = queryset.annotate(
        _history_competing_entry_id=Cast(
            KeyTextTransform(
                "entry_id", KeyTransform("competing_link", "after_snapshot")
            ),
            output_field=CharField(),
        )
    )
    visible_entry_ids = visible_entries.annotate(
        _history_entry_id=Cast("id", output_field=CharField())
    ).values("_history_entry_id")
    # Revocation blocks new decisions, not the actor's access to their own records.
    allowed = Q(actor=user)
    if is_lexical_curator(user):
        allowed |= (
            Q(target_type="entry", target_id__in=visible_entries.values("id"))
            | Q(
                target_type="sense",
                target_id__in=EntrySense.objects.filter(
                    entry__in=visible_entries
                ).values("id"),
            )
            | Q(
                target_type="writing",
                target_id__in=EntryWriting.objects.filter(
                    entry__in=visible_entries
                ).values("id"),
            )
            | Q(
                target_type="pronunciation",
                target_id__in=PronunciationVariant.objects.filter(
                    entry__in=visible_entries
                ).values("id"),
            )
            | Q(
                target_type="recording_link",
                target_id__in=RecordingEntryLink.objects.filter(
                    entry__in=visible_entries, recording__in=visible_recordings
                ).values("id"),
            )
            | Q(
                target_type="legacy_candidate",
                target_id__in=LegacyReviewCandidate.objects.values("id"),
            )
        )
        allowed |= Q(
            target_type="recording",
            action_type="preserve_competing",
            target_id__in=visible_recordings.values("id"),
            _history_competing_entry_id__in=visible_entry_ids,
        )
    scopes = regional_curator_scope_ids(user)
    if scopes:
        entry_targets = Q(
            target_type="entry",
            target_id__in=Entry.objects.filter(
                pk__in=visible_entries.values("id"), usage_dialect_id__in=scopes
            ).values("id"),
        )
        recording_targets = Q(
            target_type="recording",
            target_id__in=Recording.objects.filter(
                pk__in=visible_recordings.values("id"), usage_dialect_id__in=scopes
            ).values("id"),
        )
        pronunciation_targets = Q(
            target_type="pronunciation",
            target_id__in=PronunciationVariant.objects.filter(
                entry__in=visible_entries, dialect_id__in=scopes
            ).values("id"),
        )
        # Both historical scopes must fit the peer's grant, not just today's target.
        usage_snapshots = Q(
            before_snapshot__usage_dialect__id__in=scopes,
            after_snapshot__usage_dialect__id__in=scopes,
        )
        dialect_snapshots = Q(
            before_snapshot__dialect__id__in=scopes,
            after_snapshot__dialect__id__in=scopes,
        )
        allowed |= (
            (entry_targets | recording_targets)
            & Q(action_type__in=["review", "narrow_scope"])
            & usage_snapshots
        )
        allowed |= (
            pronunciation_targets
            & Q(action_type__in=["review", "narrow_scope"])
            & dialect_snapshots
        )
        allowed |= recording_targets & Q(
            action_type="preserve_competing",
            before_snapshot__usage_dialect__id__in=scopes,
            after_snapshot__recording__usage_dialect__id__in=scopes,
            _history_competing_entry_id__in=visible_entry_ids,
        )
        allowed |= (
            Q(
                target_type="recording_link",
                action_type="review",
                target_id__in=RecordingEntryLink.objects.filter(
                    entry__in=visible_entries,
                    recording__in=visible_recordings,
                    recording__usage_dialect_id__in=scopes,
                ).values("id"),
            )
            & usage_snapshots
        )
    return queryset.filter(allowed).distinct()
