from django.contrib import admin

from .models import (
    Concept,
    CircleMembership,
    CurationAction,
    CuratorApplication,
    CuratorGrant,
    Dialect,
    DialectCircle,
    Entry,
    EntryBookmark,
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


class EntryWritingInline(admin.TabularInline):
    model = EntryWriting
    extra = 0
    raw_id_fields = ("writing", "created_by")


class EntrySenseInline(admin.TabularInline):
    model = EntrySense
    extra = 0
    raw_id_fields = ("created_by",)


class RecordingEntryLinkInline(admin.TabularInline):
    model = RecordingEntryLink
    extra = 0
    raw_id_fields = (
        "entry",
        "sense",
        "supersedes",
        "created_by",
        "reviewed_by",
    )


@admin.register(Dialect)
class DialectAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "qualified_code_display",
        "name",
        "code",
        "parent",
        "sort_order",
    )
    list_filter = ("parent",)
    search_fields = ("name", "code", "description", "parent__name")
    autocomplete_fields = ("parent",)
    list_select_related = ("parent",)
    ordering = ("parent_id", "sort_order", "id")

    @admin.display(description="完整限定码", ordering="code")
    def qualified_code_display(self, obj):
        return obj.qualified_code


@admin.register(DialectCircle)
class DialectCircleAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "dialect", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "description", "dialect__name")
    raw_id_fields = ("dialect",)


@admin.register(CircleMembership)
class CircleMembershipAdmin(admin.ModelAdmin):
    list_display = ("id", "circle", "user", "created_at")
    raw_id_fields = ("circle", "user")


@admin.register(EntryBookmark)
class EntryBookmarkAdmin(admin.ModelAdmin):
    list_display = ("id", "entry", "user", "created_at")
    raw_id_fields = ("entry", "user")


@admin.register(Entry)
class EntryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "summary",
        "identity_note",
        "usage_dialect",
        "status",
        "visibility",
        "updated_at",
    )
    list_filter = ("status", "visibility")
    search_fields = (
        "summary",
        "identity_note",
        "entry_writings__writing__text",
    )
    raw_id_fields = ("usage_dialect", "canonical_entry", "created_by")
    inlines = (EntryWritingInline, EntrySenseInline)


@admin.register(WritingForm)
class WritingFormAdmin(admin.ModelAdmin):
    list_display = ("id", "text", "normalized_text", "form_type", "language_tag")
    list_filter = ("form_type",)
    search_fields = ("text", "normalized_text")


@admin.register(EntrySense)
class EntrySenseAdmin(admin.ModelAdmin):
    list_display = ("id", "entry", "sense_number", "gloss", "status")
    list_filter = ("status",)
    search_fields = ("gloss", "usage_note", "entry__summary")
    raw_id_fields = ("entry", "created_by")


@admin.register(Concept)
class ConceptAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "label", "updated_at")
    search_fields = ("code", "label", "definition")


@admin.register(EntrySenseConcept)
class EntrySenseConceptAdmin(admin.ModelAdmin):
    list_display = ("id", "sense", "concept", "relation_type", "created_at")
    list_filter = ("relation_type",)
    raw_id_fields = ("sense", "concept", "created_by")


@admin.register(PronunciationVariant)
class PronunciationVariantAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "entry",
        "dialect",
        "ipa",
        "base_romanization",
        "surface_romanization",
        "reading_type",
        "status",
    )
    list_filter = ("reading_type", "status")
    search_fields = (
        "entry__summary",
        "ipa",
        "base_romanization",
        "surface_romanization",
    )
    raw_id_fields = ("entry", "dialect", "created_by")


@admin.register(Recording)
class RecordingAdmin(admin.ModelAdmin):
    def has_change_permission(self, request, obj=None):
        # Managed audio changes require the audited moderation transitions.
        if obj is not None and obj.media_id:
            return False
        return super().has_change_permission(request, obj)

    exclude = (
        "media",
        "publication_consent",
        "review_reason",
        "speaker_consent_source",
        "speaker_label",
    )

    list_display = (
        "id",
        "original_gloss",
        "usage_dialect",
        "recorder",
        "recording_type",
        "status",
        "visibility",
        "created_at",
    )
    list_filter = ("recording_type", "status", "visibility")
    search_fields = ("original_gloss", "audio_url", "recorder__username")
    raw_id_fields = ("usage_dialect", "recorder")
    inlines = (RecordingEntryLinkInline,)


@admin.register(RecordingEntryLink)
class RecordingEntryLinkAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "recording",
        "entry",
        "sense",
        "role",
        "status",
        "is_current",
    )
    list_filter = ("role", "status", "is_current")
    raw_id_fields = (
        "recording",
        "entry",
        "sense",
        "supersedes",
        "created_by",
        "reviewed_by",
    )


@admin.register(EvidenceRecord)
class EvidenceRecordAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "source_type",
        "original_writing",
        "contributor",
        "created_at",
    )
    list_filter = ("source_type",)
    search_fields = ("original_text", "original_writing", "original_gloss", "citation")
    raw_id_fields = ("contributor",)

    def has_change_permission(self, request, obj=None):
        return obj is None


@admin.register(EvidenceLink)
class EvidenceLinkAdmin(admin.ModelAdmin):
    list_display = ("id", "evidence", "relation_type", "created_at")
    list_filter = ("relation_type",)
    raw_id_fields = (
        "evidence",
        "entry",
        "sense",
        "pronunciation_variant",
        "recording",
        "recording_entry_link",
        "created_by",
    )


@admin.register(UsageAttestation)
class UsageAttestationAdmin(admin.ModelAdmin):
    list_display = ("id", "entry", "dialect", "attester", "active", "attested_at")
    list_filter = ("active",)
    raw_id_fields = ("entry", "dialect", "attester")


@admin.register(CuratorGrant)
class CuratorGrantAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "role",
        "dialect",
        "valid_from",
        "valid_until",
        "revoked_at",
    )
    list_filter = ("role",)
    search_fields = ("user__username", "reason", "revocation_reason")
    raw_id_fields = ("user", "dialect", "granted_by")


@admin.register(CuratorApplication)
class CuratorApplicationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "applicant",
        "role",
        "dialect",
        "status",
        "created_at",
        "reviewed_at",
    )
    list_filter = ("role", "status")
    search_fields = ("applicant__username", "statement", "experience", "review_reason")
    raw_id_fields = ("applicant", "dialect", "reviewed_by")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return obj is None

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CurationAction)
class CurationActionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "actor",
        "action_type",
        "target_type",
        "target_id",
        "created_at",
    )
    list_filter = ("action_type", "target_type")
    search_fields = ("actor__username", "target_label", "reason")
    raw_id_fields = ("actor", "grant")
    filter_horizontal = ("evidence",)

    def has_change_permission(self, request, obj=None):
        return obj is None

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(LegacyReviewCandidate)
class LegacyReviewCandidateAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "candidate_type",
        "candidate_key",
        "primary_entry",
        "status",
        "created_at",
    )
    list_filter = ("candidate_type", "status", "source_system")
    search_fields = ("candidate_key",)
    raw_id_fields = ("primary_entry",)
    filter_horizontal = ("entries",)
