from django.db import transaction
from rest_framework import serializers

from .models import (
    Concept,
    CurationAction,
    CuratorApplication,
    CuratorGrant,
    Dialect,
    DialectCircle,
    Entry,
    EntrySense,
    EntrySenseConcept,
    EntryWriting,
    EvidenceLink,
    EvidenceRecord,
    LegacyReviewCandidate,
    PronunciationVariant,
    Recording,
    RecordingEntryLink,
    UsageAttestation,
    WritingForm,
)
from .shared_serializers import DialectRefSerializer, UserLiteSerializer
from .v2_permissions import (
    active_curator_grants,
    can_curate_entry,
    can_curate_recording,
)


def _display_writing(entry):
    writings = list(entry.entry_writings.all())
    primary = next(
        (
            link
            for link in writings
            if link.is_current
            and link.relation_type == EntryWriting.RelationType.PRIMARY
            and link.status != EntryWriting.Status.REJECTED
        ),
        None,
    )
    return primary.writing.text if primary else ""


class WritingFormSerializer(serializers.ModelSerializer):
    class Meta:
        model = WritingForm
        fields = [
            "id",
            "text",
            "normalized_text",
            "form_type",
            "language_tag",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class DialectCircleSerializer(serializers.ModelSerializer):
    dialect = DialectRefSerializer(read_only=True)
    member_count = serializers.IntegerField(read_only=True)
    recording_count = serializers.SerializerMethodField()
    is_member = serializers.BooleanField(read_only=True)

    class Meta:
        model = DialectCircle
        fields = [
            "id",
            "name",
            "description",
            "dialect",
            "member_count",
            "recording_count",
            "is_member",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_recording_count(self, obj):
        return Recording.objects.filter(
            visibility=True,
            usage_dialect_id__in=obj.dialect.descendant_ids(),
        ).count()


class EntryWritingSerializer(serializers.ModelSerializer):
    writing = WritingFormSerializer(read_only=True)

    class Meta:
        model = EntryWriting
        fields = [
            "id",
            "writing",
            "relation_type",
            "status",
            "is_current",
            "note",
            "created_at",
        ]
        read_only_fields = fields


class ConceptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Concept
        fields = ["id", "code", "label", "definition", "external_refs"]
        read_only_fields = fields


class ConceptLinkSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="concept.id", read_only=True)
    code = serializers.CharField(source="concept.code", read_only=True)
    label = serializers.CharField(source="concept.label", read_only=True)

    class Meta:
        model = EntrySenseConcept
        fields = ["id", "code", "label", "relation_type", "note"]
        read_only_fields = fields


class EntryRefSerializer(serializers.ModelSerializer):
    display_writing = serializers.SerializerMethodField()

    class Meta:
        model = Entry
        fields = ["id", "display_writing", "summary", "identity_note", "status"]
        read_only_fields = fields

    def get_display_writing(self, obj):
        return _display_writing(obj)


class EntrySenseSerializer(serializers.ModelSerializer):
    entry = EntryRefSerializer(read_only=True)
    entry_id = serializers.PrimaryKeyRelatedField(
        source="entry", queryset=Entry.objects.all(), write_only=True
    )
    concepts = ConceptLinkSerializer(source="concept_links", many=True, read_only=True)
    concept_ids = serializers.PrimaryKeyRelatedField(
        source="new_concepts",
        queryset=Concept.objects.all(),
        many=True,
        required=False,
        write_only=True,
    )
    created_by = UserLiteSerializer(read_only=True)

    class Meta:
        model = EntrySense
        fields = [
            "id",
            "entry",
            "entry_id",
            "sense_number",
            "gloss",
            "usage_note",
            "examples",
            "status",
            "concepts",
            "concept_ids",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "status", "created_by", "created_at", "updated_at"]

    def create(self, validated_data):
        concepts = validated_data.pop("new_concepts", [])
        request = self.context["request"]
        with transaction.atomic():
            sense = EntrySense.objects.create(created_by=request.user, **validated_data)
            for concept in concepts:
                EntrySenseConcept.objects.get_or_create(
                    sense=sense,
                    concept=concept,
                    relation_type=EntrySenseConcept.RelationType.EXACT,
                    defaults={"created_by": request.user},
                )
        return sense

    def update(self, instance, validated_data):
        concepts = validated_data.pop("new_concepts", [])
        instance = super().update(instance, validated_data)
        for concept in concepts:
            EntrySenseConcept.objects.get_or_create(
                sense=instance,
                concept=concept,
                relation_type=EntrySenseConcept.RelationType.EXACT,
                defaults={"created_by": self.context["request"].user},
            )
        return instance


class ProtectedScopeUpdateMixin:
    """Only uncurated drafts may edit scope outside the semantic service."""

    def update(self, instance, validated_data):
        with transaction.atomic():
            instance = type(instance).objects.select_for_update().get(pk=instance.pk)
            scope = validated_data.get(self.scope_field, serializers.empty)
            if scope is not serializers.empty:
                new_id = scope.pk if scope is not None else None
                old_id = getattr(instance, f"{self.scope_field}_id")
                if new_id != old_id and (
                    instance.status != "draft"
                    or CurationAction.objects.filter(
                        target_type=self.scope_target_type, target_id=instance.pk
                    ).exists()
                ):
                    raise serializers.ValidationError(
                        {
                            f"{self.scope_field}_id": "已整理对象的地区变更须通过整理操作并提供依据与理由"
                        }
                    )
            return super().update(instance, validated_data)


class PronunciationVariantSerializer(
    ProtectedScopeUpdateMixin, serializers.ModelSerializer
):
    scope_field = "dialect"
    scope_target_type = "pronunciation"
    entry = EntryRefSerializer(read_only=True)
    entry_id = serializers.PrimaryKeyRelatedField(
        source="entry", queryset=Entry.objects.all(), write_only=True
    )
    dialect = DialectRefSerializer(read_only=True)
    dialect_id = serializers.PrimaryKeyRelatedField(
        source="dialect", queryset=Dialect.objects.all(), write_only=True
    )
    created_by = UserLiteSerializer(read_only=True)

    class Meta:
        model = PronunciationVariant
        fields = [
            "id",
            "entry",
            "entry_id",
            "dialect",
            "dialect_id",
            "ipa",
            "base_romanization",
            "surface_romanization",
            "reading_type",
            "usage_note",
            "status",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "status", "created_by", "created_at", "updated_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        values = [
            attrs.get("ipa", getattr(self.instance, "ipa", "")),
            attrs.get(
                "base_romanization",
                getattr(self.instance, "base_romanization", ""),
            ),
            attrs.get(
                "surface_romanization",
                getattr(self.instance, "surface_romanization", ""),
            ),
        ]
        if not any(str(value or "").strip() for value in values):
            raise serializers.ValidationError("地区读音至少需要 IPA 或一种罗马字")
        return attrs

    def create(self, validated_data):
        return PronunciationVariant.objects.create(
            created_by=self.context["request"].user,
            **validated_data,
        )


class EntryCardSerializer(serializers.ModelSerializer):
    display_writing = serializers.SerializerMethodField()
    usage_dialect = DialectRefSerializer(read_only=True)
    pronunciation_variants = PronunciationVariantSerializer(many=True, read_only=True)
    concepts = serializers.SerializerMethodField()
    recording_count = serializers.SerializerMethodField()
    needs_audio = serializers.SerializerMethodField()
    evidence_count = serializers.IntegerField(read_only=True, default=0)
    attestation_count = serializers.IntegerField(read_only=True, default=0)
    is_bookmarked = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = Entry
        fields = [
            "id",
            "display_writing",
            "summary",
            "identity_note",
            "usage_dialect",
            "status",
            "pronunciation_variants",
            "concepts",
            "recording_count",
            "needs_audio",
            "evidence_count",
            "attestation_count",
            "is_bookmarked",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_display_writing(self, obj):
        return _display_writing(obj)

    def get_concepts(self, obj):
        values = {}
        for sense in obj.senses.all():
            for link in sense.concept_links.all():
                values[link.concept_id] = {
                    "id": link.concept_id,
                    "code": link.concept.code,
                    "label": link.concept.label,
                }
        return list(values.values())

    def get_recording_count(self, obj):
        return len(getattr(obj, "available_recording_links", []))

    def get_needs_audio(self, obj):
        return self.get_recording_count(obj) == 0


class EntrySerializer(ProtectedScopeUpdateMixin, EntryCardSerializer):
    scope_field = "usage_dialect"
    scope_target_type = "entry"
    summary = serializers.CharField(
        required=False, allow_blank=True, trim_whitespace=False
    )
    usage_dialect_id = serializers.PrimaryKeyRelatedField(
        source="usage_dialect",
        queryset=Dialect.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )
    initial_writing = serializers.CharField(
        required=False, allow_blank=True, trim_whitespace=False, write_only=True
    )
    writing_type = serializers.ChoiceField(
        choices=WritingForm.FormType.choices,
        default=WritingForm.FormType.UNCERTAIN,
        write_only=True,
    )
    evidence_text = serializers.CharField(
        required=False, allow_blank=True, trim_whitespace=False, write_only=True
    )
    citation = serializers.CharField(
        required=False, allow_blank=True, trim_whitespace=False, write_only=True
    )
    writings = EntryWritingSerializer(
        source="entry_writings", many=True, read_only=True
    )
    senses = EntrySenseSerializer(many=True, read_only=True)
    created_by = UserLiteSerializer(read_only=True)

    class Meta(EntryCardSerializer.Meta):
        fields = EntryCardSerializer.Meta.fields + [
            "usage_dialect_id",
            "initial_writing",
            "writing_type",
            "evidence_text",
            "citation",
            "writings",
            "senses",
            "created_by",
            "visibility",
        ]
        read_only_fields = [
            "id",
            "status",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance is None:
            summary = str(attrs.get("summary") or "").strip()
            writing = str(attrs.get("initial_writing") or "").strip()
            if not summary and not writing:
                raise serializers.ValidationError("新词条至少需要大意或一个待考写法")
        return attrs

    def _create_evidence(
        self, entry, raw_summary, raw_writing, evidence_text, citation
    ):
        if not any((raw_summary, raw_writing, evidence_text, citation)):
            return None
        request = self.context["request"]
        evidence = EvidenceRecord.objects.create(
            source_type=EvidenceRecord.SourceType.USER_STATEMENT,
            original_text=evidence_text or raw_summary,
            original_writing=raw_writing,
            original_gloss=raw_summary,
            citation=citation,
            contributor=request.user,
        )
        EvidenceLink.objects.create(
            evidence=evidence,
            entry=entry,
            relation_type=EvidenceLink.RelationType.SUBMITTED,
            created_by=request.user,
        )
        return evidence

    def create(self, validated_data):
        raw_summary = str(validated_data.pop("summary", "") or "")
        raw_writing = str(validated_data.pop("initial_writing", "") or "")
        writing_type = validated_data.pop(
            "writing_type", WritingForm.FormType.UNCERTAIN
        )
        evidence_text = str(validated_data.pop("evidence_text", "") or "")
        citation = str(validated_data.pop("citation", "") or "")
        request = self.context["request"]
        with transaction.atomic():
            entry = Entry.objects.create(
                summary=raw_summary.strip(),
                created_by=request.user,
                **validated_data,
            )
            if raw_summary.strip():
                EntrySense.objects.create(
                    entry=entry,
                    gloss=raw_summary.strip(),
                    created_by=request.user,
                )
            if raw_writing.strip():
                writing = WritingForm.objects.create(
                    text=raw_writing.strip(),
                    normalized_text=raw_writing.strip(),
                    form_type=writing_type,
                )
                EntryWriting.objects.create(
                    entry=entry,
                    writing=writing,
                    relation_type=EntryWriting.RelationType.PRIMARY,
                    created_by=request.user,
                )
            self._create_evidence(
                entry, raw_summary, raw_writing, evidence_text, citation
            )
        return entry

    def update(self, instance, validated_data):
        raw_summary = validated_data.pop("summary", None)
        raw_writing = str(validated_data.pop("initial_writing", "") or "")
        writing_type = validated_data.pop(
            "writing_type", WritingForm.FormType.UNCERTAIN
        )
        evidence_text = str(validated_data.pop("evidence_text", "") or "")
        citation = str(validated_data.pop("citation", "") or "")
        if raw_summary is not None:
            validated_data["summary"] = str(raw_summary).strip()
        with transaction.atomic():
            instance = super().update(instance, validated_data)
            if raw_writing.strip():
                writing = WritingForm.objects.create(
                    text=raw_writing.strip(),
                    normalized_text=raw_writing.strip(),
                    form_type=writing_type,
                )
                relation = (
                    EntryWriting.RelationType.ALTERNATE
                    if instance.entry_writings.filter(
                        is_current=True,
                        relation_type=EntryWriting.RelationType.PRIMARY,
                    ).exists()
                    else EntryWriting.RelationType.PRIMARY
                )
                EntryWriting.objects.create(
                    entry=instance,
                    writing=writing,
                    relation_type=relation,
                    created_by=self.context["request"].user,
                )
            self._create_evidence(
                instance,
                "" if raw_summary is None else str(raw_summary),
                raw_writing,
                evidence_text,
                citation,
            )
        return instance


class RecordingEntryLinkRefSerializer(serializers.ModelSerializer):
    entry = EntryRefSerializer(read_only=True)

    class Meta:
        model = RecordingEntryLink
        fields = [
            "id",
            "entry",
            "sense_id",
            "role",
            "status",
            "is_current",
            "review_reason",
            "created_at",
        ]
        read_only_fields = fields


class RecordingSerializer(ProtectedScopeUpdateMixin, serializers.ModelSerializer):
    scope_field = "usage_dialect"
    scope_target_type = "recording"
    usage_dialect = DialectRefSerializer(read_only=True)
    usage_dialect_id = serializers.PrimaryKeyRelatedField(
        source="usage_dialect", queryset=Dialect.objects.all(), write_only=True
    )
    recorder = UserLiteSerializer(read_only=True)
    entry_links = RecordingEntryLinkRefSerializer(many=True, read_only=True)
    evidence_count = serializers.IntegerField(read_only=True, default=0)
    primary_entry_id = serializers.PrimaryKeyRelatedField(
        source="primary_entry",
        queryset=Entry.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )
    primary_sense_id = serializers.PrimaryKeyRelatedField(
        source="primary_sense",
        queryset=EntrySense.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )
    original_writing = serializers.CharField(
        required=False, allow_blank=True, trim_whitespace=False, write_only=True
    )
    original_pronunciation = serializers.CharField(
        required=False, allow_blank=True, trim_whitespace=False, write_only=True
    )
    citation = serializers.CharField(
        required=False, allow_blank=True, trim_whitespace=False, write_only=True
    )
    original_gloss = serializers.CharField(trim_whitespace=False)

    class Meta:
        model = Recording
        fields = [
            "id",
            "audio_url",
            "usage_dialect",
            "usage_dialect_id",
            "recorder",
            "recording_type",
            "original_gloss",
            "duration_ms",
            "rights_statement",
            "status",
            "visibility",
            "entry_links",
            "evidence_count",
            "primary_entry_id",
            "primary_sense_id",
            "original_writing",
            "original_pronunciation",
            "citation",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "recorder",
            "status",
            "evidence_count",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        gloss = attrs.get("original_gloss")
        if gloss is not None and not str(gloss).strip():
            raise serializers.ValidationError(
                {"original_gloss": "请用自己的话简单说明这段录音的意思"}
            )
        entry = attrs.get("primary_entry")
        sense = attrs.get("primary_sense")
        request = self.context.get("request")
        if (
            entry
            and not entry.visibility
            and request
            and not can_curate_entry(request.user, entry)
        ):
            raise serializers.ValidationError(
                {"primary_entry_id": "不能把录音关联到不可见词条"}
            )
        if sense and (not entry or sense.entry_id != entry.id):
            raise serializers.ValidationError(
                {"primary_sense_id": "义项必须属于所选主词条"}
            )
        return attrs

    def create(self, validated_data):
        entry = validated_data.pop("primary_entry", None)
        sense = validated_data.pop("primary_sense", None)
        raw_writing = str(validated_data.pop("original_writing", "") or "")
        raw_pronunciation = str(validated_data.pop("original_pronunciation", "") or "")
        citation = str(validated_data.pop("citation", "") or "")
        raw_gloss = str(validated_data.pop("original_gloss") or "")
        request = self.context["request"]
        dialect = validated_data["usage_dialect"]
        with transaction.atomic():
            if entry is None:
                entry = Entry.objects.create(
                    summary=raw_gloss.strip(),
                    usage_dialect=dialect,
                    created_by=request.user,
                )
                sense = EntrySense.objects.create(
                    entry=entry,
                    gloss=raw_gloss.strip(),
                    created_by=request.user,
                )
                if raw_writing.strip():
                    writing = WritingForm.objects.create(
                        text=raw_writing.strip(),
                        normalized_text=raw_writing.strip(),
                        form_type=WritingForm.FormType.UNCERTAIN,
                    )
                    EntryWriting.objects.create(
                        entry=entry,
                        writing=writing,
                        relation_type=EntryWriting.RelationType.PRIMARY,
                        created_by=request.user,
                    )
            recording = Recording.objects.create(
                original_gloss=raw_gloss.strip(),
                recorder=request.user,
                **validated_data,
            )
            link = RecordingEntryLink.objects.create(
                recording=recording,
                entry=entry,
                sense=sense,
                role=RecordingEntryLink.Role.PRIMARY,
                status=RecordingEntryLink.Status.ACCEPTED,
                created_by=request.user,
                review_reason="录制者初始著录",
            )
            evidence = EvidenceRecord.objects.create(
                source_type=EvidenceRecord.SourceType.USER_STATEMENT,
                original_text=raw_gloss,
                original_writing=raw_writing,
                original_gloss=raw_gloss,
                original_pronunciation=raw_pronunciation,
                citation=citation,
                contributor=request.user,
            )
            for target in (
                {"recording": recording},
                {"recording_entry_link": link},
                {"entry": entry},
            ):
                EvidenceLink.objects.create(
                    evidence=evidence,
                    relation_type=EvidenceLink.RelationType.SUBMITTED,
                    created_by=request.user,
                    **target,
                )
            if sense:
                EvidenceLink.objects.create(
                    evidence=evidence,
                    sense=sense,
                    relation_type=EvidenceLink.RelationType.SUBMITTED,
                    created_by=request.user,
                )
        return recording

    def update(self, instance, validated_data):
        validated_data.pop("primary_entry", None)
        validated_data.pop("primary_sense", None)
        raw_writing = str(validated_data.pop("original_writing", "") or "")
        raw_pronunciation = str(validated_data.pop("original_pronunciation", "") or "")
        citation = str(validated_data.pop("citation", "") or "")
        raw_gloss = validated_data.get("original_gloss")
        if raw_gloss is not None:
            validated_data["original_gloss"] = str(raw_gloss).strip()
        with transaction.atomic():
            instance = super().update(instance, validated_data)
            if any((raw_gloss is not None, raw_writing, raw_pronunciation, citation)):
                evidence = EvidenceRecord.objects.create(
                    source_type=EvidenceRecord.SourceType.USER_STATEMENT,
                    original_text="" if raw_gloss is None else str(raw_gloss),
                    original_writing=raw_writing,
                    original_gloss="" if raw_gloss is None else str(raw_gloss),
                    original_pronunciation=raw_pronunciation,
                    citation=citation,
                    contributor=self.context["request"].user,
                )
                EvidenceLink.objects.create(
                    evidence=evidence,
                    recording=instance,
                    relation_type=EvidenceLink.RelationType.SUBMITTED,
                    created_by=self.context["request"].user,
                )
        return instance


class RecordingEntryLinkSerializer(serializers.ModelSerializer):
    recording_id = serializers.PrimaryKeyRelatedField(
        source="recording", queryset=Recording.objects.all(), write_only=True
    )
    entry = EntryRefSerializer(read_only=True)
    entry_id = serializers.PrimaryKeyRelatedField(
        source="entry", queryset=Entry.objects.all(), write_only=True
    )
    sense_id = serializers.PrimaryKeyRelatedField(
        source="sense",
        queryset=EntrySense.objects.all(),
        required=False,
        allow_null=True,
    )
    created_by = UserLiteSerializer(read_only=True)
    reviewed_by = UserLiteSerializer(read_only=True)

    class Meta:
        model = RecordingEntryLink
        fields = [
            "id",
            "recording_id",
            "entry",
            "entry_id",
            "sense_id",
            "role",
            "status",
            "is_current",
            "supersedes_id",
            "created_by",
            "reviewed_by",
            "review_reason",
            "reviewed_at",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "is_current",
            "supersedes_id",
            "created_by",
            "reviewed_by",
            "review_reason",
            "reviewed_at",
            "created_at",
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        entry = attrs.get("entry", getattr(self.instance, "entry", None))
        sense = attrs.get("sense", getattr(self.instance, "sense", None))
        recording = attrs.get("recording", getattr(self.instance, "recording", None))
        role = attrs.get("role", getattr(self.instance, "role", None))
        request = self.context.get("request")
        if (
            request
            and recording
            and not (
                recording.visibility or can_curate_recording(request.user, recording)
            )
        ):
            raise serializers.ValidationError({"recording_id": "不能修改不可见录音"})
        if (
            request
            and entry
            and not (entry.visibility or can_curate_entry(request.user, entry))
        ):
            raise serializers.ValidationError({"entry_id": "不能关联不可见词条"})
        if sense and sense.entry_id != entry.id:
            raise serializers.ValidationError({"sense_id": "义项必须属于所关联的词条"})
        if (
            self.instance is None
            and role == RecordingEntryLink.Role.PRIMARY
            and RecordingEntryLink.objects.filter(
                recording=recording,
                role=RecordingEntryLink.Role.PRIMARY,
                status=RecordingEntryLink.Status.ACCEPTED,
                is_current=True,
            ).exists()
        ):
            raise serializers.ValidationError(
                {"role": "该录音已有主词条；请使用 competing 提出竞争解释"}
            )
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        recording = validated_data["recording"]
        accepted = recording.recorder_id == request.user.id
        return RecordingEntryLink.objects.create(
            created_by=request.user,
            status=(
                RecordingEntryLink.Status.ACCEPTED
                if accepted
                else RecordingEntryLink.Status.SUGGESTED
            ),
            review_reason="录制者补充关联" if accepted else "待整理员确认",
            **validated_data,
        )


class UsageAttestationSerializer(serializers.ModelSerializer):
    entry = EntryRefSerializer(read_only=True)
    entry_id = serializers.PrimaryKeyRelatedField(
        source="entry", queryset=Entry.objects.all(), write_only=True
    )
    dialect = DialectRefSerializer(read_only=True)
    dialect_id = serializers.PrimaryKeyRelatedField(
        source="dialect", queryset=Dialect.objects.all(), write_only=True
    )
    attester = UserLiteSerializer(read_only=True)

    class Meta:
        model = UsageAttestation
        fields = [
            "id",
            "entry",
            "entry_id",
            "dialect",
            "dialect_id",
            "attester",
            "active",
            "note",
            "attested_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "attester",
            "active",
            "attested_at",
            "updated_at",
        ]

    def create(self, validated_data):
        request = self.context["request"]
        existing = UsageAttestation.objects.filter(
            attester=request.user,
            entry=validated_data["entry"],
            dialect=validated_data["dialect"],
        ).first()
        if existing:
            existing.active = True
            existing.note = validated_data.get("note", existing.note)
            existing.save(update_fields=["active", "note", "updated_at"])
            return existing
        return UsageAttestation.objects.create(attester=request.user, **validated_data)


class EvidenceRecordSerializer(serializers.ModelSerializer):
    contributor = UserLiteSerializer(read_only=True)
    source_metadata = serializers.SerializerMethodField()

    class Meta:
        model = EvidenceRecord
        fields = [
            "id",
            "source_type",
            "original_text",
            "original_writing",
            "original_gloss",
            "original_pronunciation",
            "citation",
            "source_metadata",
            "contributor",
            "created_at",
        ]
        read_only_fields = fields

    def get_source_metadata(self, obj):
        request = self.context.get("request")
        user = request.user if request else None
        if (
            user
            and user.is_authenticated
            and (
                user.is_staff
                or obj.contributor_id == user.id
                or active_curator_grants(user).exists()
            )
        ):
            return obj.source_metadata
        return {}


class LegacyReviewCandidateSerializer(serializers.ModelSerializer):
    primary_entry = EntryRefSerializer(read_only=True)
    entries = EntryRefSerializer(many=True, read_only=True)

    class Meta:
        model = LegacyReviewCandidate
        fields = [
            "id",
            "source_system",
            "candidate_key",
            "candidate_type",
            "primary_entry",
            "entries",
            "source_ids",
            "payload",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class CuratorGrantSerializer(serializers.ModelSerializer):
    user = UserLiteSerializer(read_only=True)
    dialect = DialectRefSerializer(read_only=True)
    granted_by = UserLiteSerializer(read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = CuratorGrant
        fields = [
            "id",
            "user",
            "role",
            "dialect",
            "valid_from",
            "valid_until",
            "granted_by",
            "reason",
            "revoked_at",
            "revocation_reason",
            "is_active",
        ]
        read_only_fields = fields


class CuratorApplicationSerializer(serializers.ModelSerializer):
    applicant = UserLiteSerializer(read_only=True)
    dialect = DialectRefSerializer(read_only=True)
    dialect_id = serializers.PrimaryKeyRelatedField(
        source="dialect",
        queryset=Dialect.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )
    reviewed_by = UserLiteSerializer(read_only=True)

    class Meta:
        model = CuratorApplication
        fields = [
            "id",
            "applicant",
            "role",
            "dialect",
            "dialect_id",
            "statement",
            "experience",
            "status",
            "reviewed_by",
            "review_reason",
            "reviewed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "applicant",
            "status",
            "reviewed_by",
            "review_reason",
            "reviewed_at",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        role = attrs.get("role")
        dialect = attrs.get("dialect")
        statement = str(attrs.get("statement") or "").strip()
        if len(statement) < 20:
            raise serializers.ValidationError(
                {"statement": "请至少用 20 个字说明熟悉的方言、写法或资料"}
            )
        if role == CuratorGrant.Role.REGIONAL and dialect is None:
            raise serializers.ValidationError(
                {"dialect_id": "地区整理员必须选择申请范围"}
            )
        if role == CuratorGrant.Role.LEXICAL and dialect is not None:
            raise serializers.ValidationError(
                {"dialect_id": "词条整理员不选择地区范围"}
            )
        request = self.context.get("request")
        if (
            request
            and CuratorApplication.objects.filter(
                applicant=request.user,
                role=role,
                dialect=dialect,
                status=CuratorApplication.Status.PENDING,
            ).exists()
        ):
            raise serializers.ValidationError("你已有相同范围的待审申请")
        attrs["statement"] = statement
        attrs["experience"] = str(attrs.get("experience") or "").strip()
        return attrs

    def create(self, validated_data):
        return CuratorApplication.objects.create(
            applicant=self.context["request"].user,
            **validated_data,
        )


class CuratorApplicationReviewSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(
        choices=[CuratorApplication.Status.APPROVED, CuratorApplication.Status.REJECTED]
    )
    reason = serializers.CharField(min_length=4, max_length=1000)
    valid_days = serializers.IntegerField(min_value=1, max_value=730, default=365)


class CurationActionRequestSerializer(serializers.Serializer):
    action_type = serializers.ChoiceField(choices=CurationAction.ActionType.choices)
    target_type = serializers.ChoiceField(choices=CurationAction.TargetType.choices)
    target_id = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(min_length=4, max_length=2000)
    evidence_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), required=False, default=list
    )
    changes = serializers.JSONField(required=False, default=dict)

    def validate_changes(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("更改内容必须是对象")
        return value


class CurationActionSerializer(serializers.ModelSerializer):
    actor = UserLiteSerializer(read_only=True)
    grant = CuratorGrantSerializer(read_only=True)
    evidence_ids = serializers.PrimaryKeyRelatedField(
        source="evidence", many=True, read_only=True
    )

    class Meta:
        model = CurationAction
        fields = [
            "id",
            "actor",
            "grant",
            "action_type",
            "target_type",
            "target_id",
            "target_label",
            "before_snapshot",
            "after_snapshot",
            "authority_snapshot",
            "reason",
            "evidence_ids",
            "created_at",
        ]
        read_only_fields = fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not instance.authority_snapshot:
            data["authority_snapshot"] = {
                "status": "unavailable",
                "reason": "legacy_record",
            }
        request = self.context.get("request")
        user = request.user if request else None
        if user and not user.is_staff and instance.actor_id != user.id:
            # Authorized peers need attribution and the historical authority, not profiles
            # or the grant's current administrative reason/revocation notes.
            data["actor"] = {"id": instance.actor_id}
            data["grant"] = None
            visible_evidence = self.context.get("visible_evidence")
            data["evidence_ids"] = (
                list(
                    visible_evidence.filter(pk__in=data["evidence_ids"]).values_list(
                        "pk", flat=True
                    )
                )
                if visible_evidence is not None
                else []
            )
        return data
