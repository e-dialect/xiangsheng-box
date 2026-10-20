from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Concept,
    CurationAction,
    CuratorGrant,
    Dialect,
    Entry,
    EntrySense,
    EntrySenseConcept,
    EntryWriting,
    EvidenceRecord,
    LegacyReviewCandidate,
    PronunciationVariant,
    Recording,
    RecordingEntryLink,
)
from .v2_scope import lock_scope_child
from .v2_permissions import (
    active_curator_grants,
    is_lexical_curator,
    is_regional_curator,
)

EVIDENCE_REQUIRED_ACTIONS = {
    CurationAction.ActionType.SPLIT_ENTRY,
    CurationAction.ActionType.MERGE_ENTRIES,
    CurationAction.ActionType.NARROW_SCOPE,
    CurationAction.ActionType.PRESERVE_COMPETING,
}


def _fail(message, field="action_type"):
    raise serializers.ValidationError({field: message})


def _choice(value, choices, field):
    allowed = {key for key, _label in choices}
    if value not in allowed:
        _fail("不支持该状态或类型", field)
    return value


def _entry_label(entry):
    writing = (
        entry.entry_writings.filter(
            is_current=True,
            relation_type=EntryWriting.RelationType.PRIMARY,
        )
        .exclude(status=EntryWriting.Status.REJECTED)
        .select_related("writing")
        .first()
    )
    return writing.writing.text if writing else (entry.summary or f"词条 {entry.id}")


def _dialect_snapshot(dialect):
    if not dialect:
        return None
    return {
        "id": dialect.id,
        "name": dialect.name,
        "qualified_code": dialect.qualified_code,
    }


def _entry_snapshot(entry):
    return {
        "id": entry.id,
        "label": _entry_label(entry),
        "summary": entry.summary,
        "identity_note": entry.identity_note,
        "status": entry.status,
        "usage_dialect": _dialect_snapshot(entry.usage_dialect),
        "canonical_entry_id": entry.canonical_entry_id,
        "sense_ids": list(
            entry.senses.order_by("sense_number", "id").values_list("id", flat=True)
        ),
    }


def _recording_snapshot(recording):
    return {
        "id": recording.id,
        "original_gloss": recording.original_gloss,
        "status": recording.status,
        "visibility": recording.visibility,
        "usage_dialect": _dialect_snapshot(recording.usage_dialect),
    }


def _grant_for(user, role, dialect=None):
    if user.is_staff:
        return None
    grants = active_curator_grants(user, role).select_for_update(of=("self",))
    if role == CuratorGrant.Role.LEXICAL:
        return grants.first()
    if dialect:
        for grant in grants:
            if dialect.id in grant.dialect.descendant_ids():
                return grant
    return None


def _require_lexical(user):
    if not is_lexical_curator(user):
        _fail("该操作需要词条整理员权限")
    return _grant_for(user, CuratorGrant.Role.LEXICAL)


def _require_regional(user, dialect):
    if not is_regional_curator(user, dialect):
        _fail("该操作不在你的地区授权范围内")
    return _grant_for(user, CuratorGrant.Role.REGIONAL, dialect)


def _load_evidence(ids, required=False):
    normalized = list(dict.fromkeys(int(value) for value in (ids or [])))
    if required and not normalized:
        _fail("拆分、合并、缩小范围和竞争解释必须选择依据", "evidence_ids")
    evidence = list(EvidenceRecord.objects.filter(id__in=normalized))
    if len(evidence) != len(normalized):
        _fail("有依据记录不存在", "evidence_ids")
    return evidence


def _review_link(link, status, actor, reason):
    _choice(status, RecordingEntryLink.Status.choices, "changes.status")
    if (
        status == RecordingEntryLink.Status.ACCEPTED
        and link.role == RecordingEntryLink.Role.PRIMARY
        and RecordingEntryLink.objects.filter(
            recording=link.recording,
            role=RecordingEntryLink.Role.PRIMARY,
            status=RecordingEntryLink.Status.ACCEPTED,
            is_current=True,
        )
        .exclude(pk=link.pk)
        .exists()
    ):
        _fail("该录音已有接受的主词条；请保留为竞争解释", "changes.status")
    before = {
        "id": link.id,
        "recording_id": link.recording_id,
        "entry_id": link.entry_id,
        "sense_id": link.sense_id,
        "role": link.role,
        "status": link.status,
        "is_current": link.is_current,
    }
    link.is_current = False
    link.save(update_fields=["is_current"])
    successor = RecordingEntryLink.objects.create(
        recording=link.recording,
        entry=link.entry,
        sense=link.sense,
        role=link.role,
        status=status,
        is_current=True,
        supersedes=link,
        created_by=actor,
        reviewed_by=actor,
        review_reason=reason,
        reviewed_at=timezone.now(),
    )
    after = {
        "id": successor.id,
        "recording_id": successor.recording_id,
        "entry_id": successor.entry_id,
        "sense_id": successor.sense_id,
        "role": successor.role,
        "status": successor.status,
        "is_current": successor.is_current,
        "supersedes_id": link.id,
    }
    return before, after, f"录音关联 {link.id}"


def _review(actor, target_type, target_id, changes, reason):
    status = changes.get("status")
    if target_type == CurationAction.TargetType.ENTRY:
        obj = (
            Entry.objects.select_for_update()
            .select_related("usage_dialect")
            .get(pk=target_id)
        )
        grant = _require_lexical(actor)
        _choice(
            status,
            [(Entry.Status.REVIEWED, ""), (Entry.Status.DISPUTED, "")],
            "changes.status",
        )
        before = _entry_snapshot(obj)
        obj.status = status
        obj.save(update_fields=["status", "updated_at"])
        return grant, before, _entry_snapshot(obj), _entry_label(obj)
    if target_type == CurationAction.TargetType.SENSE:
        obj = lock_scope_child(EntrySense, target_id, Entry, "entry")
        grant = _require_lexical(actor)
        _choice(
            status,
            [(EntrySense.Status.REVIEWED, ""), (EntrySense.Status.DISPUTED, "")],
            "changes.status",
        )
        before = {
            "id": obj.id,
            "entry_id": obj.entry_id,
            "gloss": obj.gloss,
            "status": obj.status,
        }
        obj.status = status
        obj.save(update_fields=["status", "updated_at"])
        after = {**before, "status": obj.status}
        return grant, before, after, obj.gloss[:240]
    if target_type == CurationAction.TargetType.WRITING:
        obj = lock_scope_child(EntryWriting, target_id, Entry, "entry")
        grant = _require_lexical(actor)
        _choice(status, EntryWriting.Status.choices, "changes.status")
        before = {
            "id": obj.id,
            "entry_id": obj.entry_id,
            "writing": obj.writing.text,
            "status": obj.status,
        }
        obj.status = status
        obj.save(update_fields=["status"])
        return grant, before, {**before, "status": obj.status}, obj.writing.text
    if target_type == CurationAction.TargetType.PRONUNCIATION:
        obj = (
            PronunciationVariant.objects.select_for_update()
            .select_related("entry", "dialect")
            .get(pk=target_id)
        )
        grant = (
            _grant_for(actor, CuratorGrant.Role.LEXICAL)
            if is_lexical_curator(actor)
            else _require_regional(actor, obj.dialect)
        )
        _choice(status, PronunciationVariant.Status.choices, "changes.status")
        before = {
            "id": obj.id,
            "entry_id": obj.entry_id,
            "dialect": _dialect_snapshot(obj.dialect),
            "status": obj.status,
        }
        obj.status = status
        obj.save(update_fields=["status", "updated_at"])
        return grant, before, {**before, "status": obj.status}, str(obj)[:240]
    if target_type == CurationAction.TargetType.RECORDING:
        obj = (
            Recording.objects.select_for_update()
            .select_related("usage_dialect")
            .get(pk=target_id)
        )
        grant = _require_regional(actor, obj.usage_dialect)
        _choice(status, Recording.Status.choices, "changes.status")
        before = _recording_snapshot(obj)
        obj.status = status
        if status == Recording.Status.PUBLISHED:
            obj.visibility = True
        elif status == Recording.Status.REJECTED:
            obj.visibility = False
        obj.save(update_fields=["status", "visibility", "updated_at"])
        return grant, before, _recording_snapshot(obj), str(obj)[:240]
    if target_type == CurationAction.TargetType.RECORDING_LINK:
        obj = lock_scope_child(
            RecordingEntryLink, target_id, Recording, "recording", is_current=True
        )
        grant = (
            _grant_for(actor, CuratorGrant.Role.LEXICAL)
            if is_lexical_curator(actor)
            else _require_regional(actor, obj.recording.usage_dialect)
        )
        before, after, label = _review_link(obj, status, actor, reason)
        before["usage_dialect"] = _dialect_snapshot(obj.recording.usage_dialect)
        after["usage_dialect"] = _dialect_snapshot(obj.recording.usage_dialect)
        return grant, before, after, label
    _fail("该对象不支持状态审核", "target_type")


def _narrow_scope(actor, target_type, target_id, changes):
    dialect_id = changes.get("dialect_id")
    try:
        narrowed = Dialect.objects.get(pk=dialect_id)
    except (Dialect.DoesNotExist, TypeError, ValueError):
        _fail("请选择有效的更细地区", "changes.dialect_id")

    if target_type == CurationAction.TargetType.ENTRY:
        obj = (
            Entry.objects.select_for_update()
            .select_related("usage_dialect")
            .get(pk=target_id)
        )
        original = obj.usage_dialect
        grant = _require_regional(actor, original)
        before = _entry_snapshot(obj)
        field = "usage_dialect"
        label = _entry_label(obj)
    elif target_type == CurationAction.TargetType.RECORDING:
        obj = (
            Recording.objects.select_for_update()
            .select_related("usage_dialect")
            .get(pk=target_id)
        )
        original = obj.usage_dialect
        grant = _require_regional(actor, original)
        before = _recording_snapshot(obj)
        field = "usage_dialect"
        label = str(obj)[:240]
    elif target_type == CurationAction.TargetType.PRONUNCIATION:
        obj = (
            PronunciationVariant.objects.select_for_update()
            .select_related("dialect", "entry")
            .get(pk=target_id)
        )
        original = obj.dialect
        grant = _require_regional(actor, original)
        before = {
            "id": obj.id,
            "entry_id": obj.entry_id,
            "dialect": _dialect_snapshot(original),
        }
        field = "dialect"
        label = str(obj)[:240]
    else:
        _fail("只能缩小词条、录音或地区读音的范围", "target_type")

    if (
        not original
        or narrowed.id == original.id
        or narrowed.id not in original.descendant_ids()
    ):
        _fail("新范围必须是原贡献范围的下级地区", "changes.dialect_id")
    setattr(obj, field, narrowed)
    obj.save(update_fields=[field, "updated_at"])
    if isinstance(obj, Entry):
        after = _entry_snapshot(obj)
    elif isinstance(obj, Recording):
        after = _recording_snapshot(obj)
    else:
        after = {
            "id": obj.id,
            "entry_id": obj.entry_id,
            "dialect": _dialect_snapshot(narrowed),
        }
    return grant, before, after, label


def _split_entry(actor, entry, changes):
    grant = _require_lexical(actor)
    sense_ids = list(
        dict.fromkeys(int(value) for value in changes.get("sense_ids", []))
    )
    source_senses = set(entry.senses.values_list("id", flat=True))
    if not sense_ids or not set(sense_ids).issubset(source_senses):
        _fail("请选择原词条中要拆出的义项", "changes.sense_ids")
    if set(sense_ids) == source_senses:
        _fail("原词条至少需保留一个义项", "changes.sense_ids")
    before = _entry_snapshot(entry)
    created = Entry.objects.create(
        summary=str(changes.get("summary") or "").strip(),
        identity_note=str(changes.get("identity_note") or "").strip(),
        usage_dialect=entry.usage_dialect,
        status=Entry.Status.DRAFT,
        created_by=actor,
        visibility=entry.visibility,
        metadata={"split_from_entry_id": entry.id},
    )
    EntrySense.objects.filter(entry=entry, id__in=sense_ids).update(entry=created)
    writing_ids = list(
        dict.fromkeys(int(value) for value in changes.get("writing_link_ids", []))
    )
    writings = list(
        entry.entry_writings.filter(id__in=writing_ids, is_current=True).select_related(
            "writing"
        )
    )
    if not writings:
        primary = (
            entry.entry_writings.filter(
                is_current=True, relation_type=EntryWriting.RelationType.PRIMARY
            )
            .exclude(status=EntryWriting.Status.REJECTED)
            .select_related("writing")
            .first()
        )
        writings = [primary] if primary else []
    for index, link in enumerate(writings):
        EntryWriting.objects.create(
            entry=created,
            writing=link.writing,
            relation_type=(
                EntryWriting.RelationType.PRIMARY
                if index == 0
                else EntryWriting.RelationType.ALTERNATE
            ),
            status=EntryWriting.Status.DRAFT,
            note=f"从词条 {entry.id} 拆分",
            created_by=actor,
        )
    entry.status = Entry.Status.DISPUTED
    entry.save(update_fields=["status", "updated_at"])
    return (
        grant,
        before,
        {"source": _entry_snapshot(entry), "created": _entry_snapshot(created)},
        _entry_label(entry),
    )


def _merge_entries(actor, canonical, changes):
    grant = _require_lexical(actor)
    source_ids = list(
        dict.fromkeys(int(value) for value in changes.get("source_entry_ids", []))
    )
    source_ids = [value for value in source_ids if value != canonical.id]
    sources = list(
        Entry.objects.select_for_update()
        .filter(id__in=source_ids)
        .select_related("usage_dialect")
    )
    if not source_ids or len(sources) != len(source_ids):
        _fail("请选择完整的待合并词条列表", "changes.source_entry_ids")
    if canonical.status == Entry.Status.REDIRECTED:
        _fail("不能将已跳转词条作为合并目标", "target_id")
    before = {
        "canonical": _entry_snapshot(canonical),
        "sources": [_entry_snapshot(item) for item in sources],
    }
    for source in sources:
        source.status = Entry.Status.REDIRECTED
        source.canonical_entry = canonical
        source.save(update_fields=["status", "canonical_entry", "updated_at"])
    canonical.status = Entry.Status.REVIEWED
    canonical.save(update_fields=["status", "updated_at"])
    after = {
        "canonical": _entry_snapshot(canonical),
        "sources": [_entry_snapshot(item) for item in sources],
    }
    return grant, before, after, _entry_label(canonical)


def _link_concept(actor, sense, changes):
    grant = _require_lexical(actor)
    try:
        concept = Concept.objects.get(pk=changes.get("concept_id"))
    except (Concept.DoesNotExist, TypeError, ValueError):
        _fail("请选择有效的概念", "changes.concept_id")
    relation = changes.get("relation_type", EntrySenseConcept.RelationType.EXACT)
    _choice(relation, EntrySenseConcept.RelationType.choices, "changes.relation_type")
    before = {
        "sense_id": sense.id,
        "concept_links": list(
            sense.concept_links.values("concept_id", "relation_type", "note")
        ),
    }
    link, created = EntrySenseConcept.objects.get_or_create(
        sense=sense,
        concept=concept,
        relation_type=relation,
        defaults={"note": str(changes.get("note") or "").strip(), "created_by": actor},
    )
    after = {
        "link_id": link.id,
        "created": created,
        "concept_id": concept.id,
        "relation_type": relation,
    }
    return grant, before, after, f"{sense.gloss[:160]} → {concept.label}"


def _preserve_competing(actor, recording, changes, reason):
    try:
        entry = Entry.objects.get(pk=changes.get("entry_id"))
    except (Entry.DoesNotExist, TypeError, ValueError):
        _fail("请选择竞争解释对应的词条", "changes.entry_id")
    grant = (
        _grant_for(actor, CuratorGrant.Role.LEXICAL)
        if is_lexical_curator(actor)
        else _require_regional(actor, recording.usage_dialect)
    )
    sense = None
    if changes.get("sense_id"):
        try:
            sense = EntrySense.objects.get(pk=changes["sense_id"], entry=entry)
        except EntrySense.DoesNotExist:
            _fail("义项必须属于竞争词条", "changes.sense_id")
    if RecordingEntryLink.objects.filter(
        recording=recording,
        entry=entry,
        role=RecordingEntryLink.Role.COMPETING,
        is_current=True,
    ).exists():
        _fail("这个竞争解释已经存在", "changes.entry_id")
    before = _recording_snapshot(recording)
    link = RecordingEntryLink.objects.create(
        recording=recording,
        entry=entry,
        sense=sense,
        role=RecordingEntryLink.Role.COMPETING,
        status=RecordingEntryLink.Status.DISPUTED,
        created_by=actor,
        reviewed_by=actor,
        review_reason=reason,
        reviewed_at=timezone.now(),
    )
    after = {
        "recording": before,
        "competing_link": {
            "id": link.id,
            "entry_id": entry.id,
            "sense_id": link.sense_id,
            "role": link.role,
            "status": link.status,
        },
    }
    return grant, before, after, f"{str(recording)[:120]} ↔ {_entry_label(entry)}"


@transaction.atomic
def perform_curation_action(actor, validated_data):
    action_type = validated_data["action_type"]
    target_type = validated_data["target_type"]
    target_id = validated_data["target_id"]
    changes = validated_data.get("changes") or {}
    reason = str(validated_data["reason"]).strip()
    evidence = _load_evidence(
        validated_data.get("evidence_ids"),
        required=action_type in EVIDENCE_REQUIRED_ACTIONS,
    )

    try:
        if action_type == CurationAction.ActionType.REVIEW:
            grant, before, after, label = _review(
                actor, target_type, target_id, changes, reason
            )
        elif action_type == CurationAction.ActionType.NARROW_SCOPE:
            grant, before, after, label = _narrow_scope(
                actor, target_type, target_id, changes
            )
        elif action_type == CurationAction.ActionType.SPLIT_ENTRY:
            if target_type != CurationAction.TargetType.ENTRY:
                _fail("拆分操作的对象必须是词条", "target_type")
            entry = (
                Entry.objects.select_for_update()
                .select_related("usage_dialect")
                .get(pk=target_id)
            )
            grant, before, after, label = _split_entry(actor, entry, changes)
        elif action_type == CurationAction.ActionType.MERGE_ENTRIES:
            if target_type != CurationAction.TargetType.ENTRY:
                _fail("合并操作的目标必须是词条", "target_type")
            canonical = (
                Entry.objects.select_for_update()
                .select_related("usage_dialect")
                .get(pk=target_id)
            )
            grant, before, after, label = _merge_entries(actor, canonical, changes)
        elif action_type == CurationAction.ActionType.LINK_CONCEPT:
            if target_type != CurationAction.TargetType.SENSE:
                _fail("概念只能关联到词条义项", "target_type")
            sense = lock_scope_child(EntrySense, target_id, Entry, "entry")
            grant, before, after, label = _link_concept(actor, sense, changes)
        elif action_type == CurationAction.ActionType.PRESERVE_COMPETING:
            if target_type != CurationAction.TargetType.RECORDING:
                _fail("竞争解释必须指向一段录音", "target_type")
            recording = (
                Recording.objects.select_for_update()
                .select_related("usage_dialect")
                .get(pk=target_id)
            )
            grant, before, after, label = _preserve_competing(
                actor, recording, changes, reason
            )
        elif action_type == CurationAction.ActionType.RESOLVE_LEGACY:
            if target_type != CurationAction.TargetType.LEGACY_CANDIDATE:
                _fail("旧库处理必须指向旧库候选", "target_type")
            candidate = LegacyReviewCandidate.objects.select_for_update().get(
                pk=target_id
            )
            grant = _require_lexical(actor)
            status = changes.get("status")
            _choice(
                status,
                [
                    (LegacyReviewCandidate.Status.ACCEPTED, ""),
                    (LegacyReviewCandidate.Status.REJECTED, ""),
                ],
                "changes.status",
            )
            before = {
                "id": candidate.id,
                "status": candidate.status,
                "payload": candidate.payload,
            }
            candidate.status = status
            candidate.save(update_fields=["status", "updated_at"])
            after = {
                "id": candidate.id,
                "status": candidate.status,
                "payload": candidate.payload,
            }
            label = candidate.candidate_key[:240]
        else:
            _fail("不支持该整理操作")
    except (
        Entry.DoesNotExist,
        EntrySense.DoesNotExist,
        EntryWriting.DoesNotExist,
        PronunciationVariant.DoesNotExist,
        Recording.DoesNotExist,
        RecordingEntryLink.DoesNotExist,
        LegacyReviewCandidate.DoesNotExist,
    ):
        _fail("待整理对象不存在", "target_id")

    captured_at = timezone.now()
    if grant is None and not actor.is_staff:
        _fail("授权已失效，请重新检查整理权限")
    if grant is not None:
        if not (
            grant.revoked_at is None
            and grant.valid_from <= captured_at < grant.valid_until
        ):
            _fail("授权已失效，请重新检查整理权限")
        authority_snapshot = {
            "version": 1,
            "status": "captured",
            "captured_at": captured_at.isoformat(),
            "mode": "grant",
            "grant_id": grant.id,
            "role": grant.role,
            "dialect": _dialect_snapshot(grant.dialect),
            "valid_from": grant.valid_from.isoformat(),
            "valid_until": grant.valid_until.isoformat(),
            "revoked_at": None,
        }
    else:
        authority_snapshot = {
            "version": 1,
            "status": "captured",
            "captured_at": captured_at.isoformat(),
            "mode": "staff",
            "role": "staff",
            "dialect": None,
        }
    action = CurationAction.objects.create(
        actor=actor,
        grant=grant,
        action_type=action_type,
        target_type=target_type,
        target_id=target_id,
        target_label=label,
        before_snapshot=before,
        after_snapshot=after,
        authority_snapshot=authority_snapshot,
        reason=reason,
    )
    if evidence:
        action.evidence.set(evidence)
    return action
