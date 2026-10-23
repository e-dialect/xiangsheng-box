from datetime import timedelta

from django.db import transaction
from django.db.models import BooleanField, Count, Exists, OuterRef, Prefetch, Q, Value
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, MethodNotAllowed
from rest_framework.response import Response
from rest_framework.views import APIView
from utils.exceptions.types.bad_request import BadRequestException

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
    EvidenceRecord,
    LegacyReviewCandidate,
    PronunciationVariant,
    Recording,
    RecordingEntryLink,
    UsageAttestation,
    WritingForm,
)
from .shared_serializers import DialectRefSerializer, DialectSerializer
from .v2_permissions import (
    IsActiveCurator,
    IsLexicalCurator,
    V2ResourcePermission,
    active_curator_grants,
    can_curate_entry,
    can_curate_recording,
    is_lexical_curator,
    is_regional_curator,
    regional_curator_scope_ids,
)
from .v2_serializers import (
    ConceptSerializer,
    CurationActionRequestSerializer,
    CurationActionSerializer,
    CuratorApplicationReviewSerializer,
    CuratorApplicationSerializer,
    CuratorGrantSerializer,
    DialectCircleSerializer,
    EntryCardSerializer,
    EntrySenseSerializer,
    EntrySerializer,
    EvidenceRecordSerializer,
    LegacyReviewCandidateSerializer,
    PronunciationVariantSerializer,
    RecordingEntryLinkSerializer,
    RecordingSerializer,
    UsageAttestationSerializer,
    WritingFormSerializer,
)
from .v2_governance import perform_curation_action
from .v2_history import CurationHistoryPermission, history_for_user


def parse_boolean(value, name):
    if value is None or value == "":
        return None
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes"}:
        return True
    if normalized in {"0", "false", "no"}:
        return False
    raise BadRequestException(f"{name} 只能是 true 或 false")


def selected_dialect_ids(request):
    value = request.query_params.get("dialect_id")
    if not value:
        return None
    dialect = Dialect.objects.filter(pk=value).first()
    if dialect is None:
        raise BadRequestException("dialect_id 对应的地区不存在")
    scope = request.query_params.get("dialect_scope", "exact")
    if scope not in {"exact", "subtree"}:
        raise BadRequestException("dialect_scope 只能是 exact 或 subtree")
    return dialect.descendant_ids() if scope == "subtree" else [dialect.id]


def visible_entries_for_user(user):
    queryset = Entry.objects.all()
    if user and user.is_authenticated:
        if user.is_staff or is_lexical_curator(user):
            return queryset
        regional_ids = regional_curator_scope_ids(user)
        scope_filter = Q()
        if regional_ids:
            scope_filter = Q(usage_dialect_id__in=regional_ids) | Q(
                recording_links__recording__usage_dialect_id__in=regional_ids
            )
        return queryset.filter(
            Q(visibility=True) | Q(created_by=user) | scope_filter
        ).distinct()
    return queryset.filter(visibility=True)


def visible_recordings_for_user(user):
    queryset = Recording.objects.all()
    if user and user.is_authenticated:
        if user.is_staff:
            return queryset
        regional_ids = regional_curator_scope_ids(user)
        scope_filter = Q(usage_dialect_id__in=regional_ids) if regional_ids else Q()
        return queryset.filter(Q(visibility=True) | Q(recorder=user) | scope_filter)
    return queryset.filter(visibility=True)


def available_recording_links_for_user(user):
    queryset = RecordingEntryLink.objects.filter(is_current=True).exclude(
        status=RecordingEntryLink.Status.REJECTED
    )
    if user and user.is_authenticated:
        if user.is_staff:
            return queryset
        regional_ids = regional_curator_scope_ids(user)
        scope_filter = (
            Q(recording__usage_dialect_id__in=regional_ids) if regional_ids else Q()
        )
        return queryset.filter(
            Q(recording__visibility=True) | Q(recording__recorder=user) | scope_filter
        )
    return queryset.filter(recording__visibility=True)


def visible_evidence_for_user(user):
    entries = visible_entries_for_user(user)
    recordings = visible_recordings_for_user(user)
    return EvidenceRecord.objects.filter(
        Q(claim_links__entry__in=entries)
        | Q(claim_links__sense__entry__in=entries)
        | Q(claim_links__pronunciation_variant__entry__in=entries)
        | Q(claim_links__recording__in=recordings)
        | Q(claim_links__recording_entry_link__recording__in=recordings)
    ).distinct()


class DialectWritePermission(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_staff)


class DialectViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]
    queryset = Dialect.objects.select_related("parent").prefetch_related("children")
    serializer_class = DialectSerializer
    permission_classes = [DialectWritePermission]

    def get_serializer_class(self):
        if self.action == "list" and parse_boolean(
            self.request.query_params.get("flat"), "flat"
        ):
            return DialectRefSerializer
        return DialectSerializer

    def perform_create(self, serializer):
        dialect = serializer.save()
        DialectCircle.objects.get_or_create(
            dialect=dialect,
            defaults={
                "name": f"{dialect.name}圈",
                "description": dialect.description
                or f"一起听、录和整理{dialect.name}乡音。",
            },
        )

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == "list":
            parent_id = self.request.query_params.get("parent_id")
            if not parse_boolean(self.request.query_params.get("flat"), "flat"):
                queryset = (
                    queryset.filter(parent__isnull=True)
                    if parent_id is None
                    else queryset.filter(parent_id=parent_id)
                )
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(code__icontains=search)
            )
        return queryset.order_by("sort_order", "id")

    @action(detail=False, methods=["get"], permission_classes=[permissions.AllowAny])
    def resolve(self, request):
        qualified_code = request.query_params.get("qualified_code", "").strip()
        if not qualified_code:
            raise BadRequestException("qualified_code 不能为空")
        segments = qualified_code.split(".")
        node = Dialect.objects.filter(parent__isnull=True, code=segments[0]).first()
        for segment in segments[1:]:
            if node is None:
                break
            node = Dialect.objects.filter(parent=node, code=segment).first()
        if node is None:
            node = next(
                (
                    candidate
                    for candidate in Dialect.objects.all().iterator()
                    if qualified_code in (candidate.aliases or [])
                ),
                None,
            )
        if node is None:
            from rest_framework.exceptions import NotFound

            raise NotFound("方言限定码不存在")
        return Response(self.get_serializer(node).data)

    @action(
        detail=True,
        methods=["put", "delete"],
        permission_classes=[permissions.IsAuthenticated],
    )
    def follow(self, request, pk=None):
        dialect = self.get_object()
        info = request.user.user_info
        if request.method == "PUT":
            info.followed_dialects.add(dialect)
            following = True
        elif info.primary_dialect_id == dialect.id:
            info.followed_dialects.add(dialect)
            following = True
        else:
            info.followed_dialects.remove(dialect)
            following = False
        return Response({"dialect_id": dialect.id, "following": following})


class DialectCircleViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DialectCircleSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = (
            DialectCircle.objects.filter(is_active=True)
            .select_related("dialect", "dialect__parent")
            .annotate(member_count=Count("members", distinct=True))
        )
        user = self.request.user
        if user and user.is_authenticated:
            queryset = queryset.annotate(
                is_member=Exists(
                    CircleMembership.objects.filter(circle_id=OuterRef("pk"), user=user)
                )
            )
        else:
            queryset = queryset.annotate(
                is_member=Value(False, output_field=BooleanField())
            )
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(description__icontains=search)
                | Q(dialect__name__icontains=search)
            )
        return queryset.order_by("dialect__sort_order", "id")

    @action(
        detail=True,
        methods=["post", "delete"],
        permission_classes=[permissions.IsAuthenticated],
    )
    def membership(self, request, pk=None):
        circle = self.get_object()
        if request.method == "POST":
            _, changed = CircleMembership.objects.get_or_create(
                circle=circle, user=request.user
            )
            request.user.user_info.followed_dialects.add(circle.dialect)
            is_member = True
        else:
            deleted, _ = CircleMembership.objects.filter(
                circle=circle, user=request.user
            ).delete()
            changed = bool(deleted)
            if request.user.user_info.primary_dialect_id != circle.dialect_id:
                request.user.user_info.followed_dialects.remove(circle.dialect)
            is_member = False
        return Response(
            {
                "changed": changed,
                "is_member": is_member,
                "member_count": CircleMembership.objects.filter(circle=circle).count(),
            }
        )

    @action(detail=True, methods=["get"], permission_classes=[permissions.AllowAny])
    def recordings(self, request, pk=None):
        circle = self.get_object()
        queryset = (
            visible_recordings_for_user(request.user)
            .filter(usage_dialect_id__in=circle.dialect.descendant_ids())
            .select_related("usage_dialect", "usage_dialect__parent", "recorder")
            .prefetch_related(
                Prefetch(
                    "entry_links",
                    queryset=available_recording_links_for_user(self.request.user)
                    .filter(entry__in=visible_entries_for_user(self.request.user))
                    .select_related("sense", "entry")
                    .prefetch_related("entry__entry_writings__writing"),
                ),
            )
            .annotate(evidence_count=Count("evidence_links", distinct=True))
            .order_by("-created_at", "-id")
        )
        page = self.paginate_queryset(queryset)
        serializer = RecordingSerializer(
            page if page is not None else queryset,
            many=True,
            context=self.get_serializer_context(),
        )
        return (
            self.get_paginated_response(serializer.data)
            if page is not None
            else Response(serializer.data)
        )


def entry_api_queryset(user):
    links = available_recording_links_for_user(user).select_related(
        "recording", "sense"
    )
    return (
        visible_entries_for_user(user)
        .select_related("usage_dialect", "usage_dialect__parent", "created_by")
        .prefetch_related(
            Prefetch(
                "entry_writings",
                queryset=EntryWriting.objects.filter(is_current=True).select_related(
                    "writing"
                ),
            ),
            Prefetch(
                "senses",
                queryset=EntrySense.objects.select_related(
                    "created_by"
                ).prefetch_related(
                    Prefetch(
                        "concept_links",
                        queryset=EntrySenseConcept.objects.select_related("concept"),
                    )
                ),
            ),
            Prefetch(
                "pronunciation_variants",
                queryset=PronunciationVariant.objects.exclude(
                    status=PronunciationVariant.Status.REJECTED
                ).select_related("dialect", "dialect__parent", "created_by"),
            ),
            Prefetch(
                "recording_links", queryset=links, to_attr="available_recording_links"
            ),
        )
        .annotate(
            evidence_count=Count("evidence_links", distinct=True),
            attestation_count=Count(
                "usage_attestations",
                filter=Q(usage_attestations__active=True),
                distinct=True,
            ),
            is_bookmarked=(
                Exists(EntryBookmark.objects.filter(entry_id=OuterRef("pk"), user=user))
                if user and user.is_authenticated
                else Value(False, output_field=BooleanField())
            ),
        )
    )


class EntryViewSet(viewsets.ModelViewSet):
    http_method_names = [
        "get",
        "post",
        "put",
        "patch",
        "delete",
        "head",
        "options",
    ]
    permission_classes = [V2ResourcePermission]

    @action(detail=False, methods=["get"])
    def suggestions(self, request):
        from .restoration import entry_suggestions

        return entry_suggestions(self, request)

    @action(detail=False, methods=["get"])
    def popular(self, request):
        from .restoration import entry_suggestions

        return entry_suggestions(self, request, popular=True)

    def get_serializer_class(self):
        return EntryCardSerializer if self.action == "list" else EntrySerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        instance = entry_api_queryset(request.user).get(pk=serializer.instance.pk)
        output = EntrySerializer(instance, context=self.get_serializer_context())
        return Response(
            output.data,
            status=status.HTTP_201_CREATED,
            headers=self.get_success_headers(output.data),
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        refreshed = entry_api_queryset(request.user).get(pk=instance.pk)
        return Response(
            EntrySerializer(refreshed, context=self.get_serializer_context()).data
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "词条不可通过公开接口删除；请由整理员保留修订记录。"},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @action(
        detail=True,
        methods=["put", "delete"],
        permission_classes=[permissions.IsAuthenticated],
    )
    def bookmark(self, request, pk=None):
        entry = self.get_object()
        if request.method == "PUT":
            _, changed = EntryBookmark.objects.get_or_create(
                entry=entry, user=request.user
            )
            bookmarked = True
        else:
            deleted, _ = EntryBookmark.objects.filter(
                entry=entry, user=request.user
            ).delete()
            changed = bool(deleted)
            bookmarked = False
        return Response(
            {"entry_id": entry.id, "bookmarked": bookmarked, "changed": changed}
        )

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[permissions.IsAuthenticated],
    )
    def bookmarks(self, request):
        queryset = self.filter_queryset(
            self.get_queryset().filter(bookmarks__user=request.user)
        )
        page = self.paginate_queryset(queryset)
        serializer = EntryCardSerializer(
            page if page is not None else queryset,
            many=True,
            context=self.get_serializer_context(),
        )
        return (
            self.get_paginated_response(serializer.data)
            if page is not None
            else Response(serializer.data)
        )

    def get_queryset(self):
        queryset = entry_api_queryset(self.request.user)
        search = (
            self.request.query_params.get("q")
            or self.request.query_params.get("search")
            or ""
        ).strip()
        if search:
            queryset = queryset.filter(
                Q(summary__icontains=search)
                | Q(identity_note__icontains=search)
                | Q(
                    entry_writings__is_current=True,
                    entry_writings__writing__text__icontains=search,
                )
                | Q(
                    entry_writings__is_current=True,
                    entry_writings__writing__normalized_text__icontains=search,
                )
                | Q(senses__gloss__icontains=search)
                | Q(pronunciation_variants__ipa__icontains=search)
                | Q(pronunciation_variants__base_romanization__icontains=search)
                | Q(pronunciation_variants__surface_romanization__icontains=search)
                | Q(senses__concept_links__concept__code__icontains=search)
                | Q(senses__concept_links__concept__label__icontains=search)
                | Q(evidence_links__evidence__original_writing__icontains=search)
                | Q(evidence_links__evidence__original_gloss__icontains=search)
            )
        filters = {
            "status": "status",
            "writing_type": "entry_writings__writing__form_type",
            "source_type": "evidence_links__evidence__source_type",
        }
        for parameter, lookup in filters.items():
            value = self.request.query_params.get(parameter)
            if value:
                queryset = queryset.filter(**{lookup: value})
        writing = self.request.query_params.get("writing")
        if writing:
            queryset = queryset.filter(
                entry_writings__is_current=True,
                entry_writings__writing__text__iexact=writing.strip(),
            )
        ipa = self.request.query_params.get("ipa")
        if ipa:
            queryset = queryset.filter(
                pronunciation_variants__ipa__icontains=ipa.strip()
            )
        romanization = self.request.query_params.get("romanization")
        if romanization:
            queryset = queryset.filter(
                Q(
                    pronunciation_variants__base_romanization__icontains=romanization.strip()
                )
                | Q(
                    pronunciation_variants__surface_romanization__icontains=romanization.strip()
                )
            )
        source = self.request.query_params.get("source")
        if source:
            queryset = queryset.filter(
                evidence_links__evidence__citation__icontains=source.strip()
            )
        concept = self.request.query_params.get("concept")
        if concept:
            if concept.isdigit():
                queryset = queryset.filter(senses__concept_links__concept_id=concept)
            else:
                queryset = queryset.filter(
                    senses__concept_links__concept__code__iexact=concept
                )
        ids = selected_dialect_ids(self.request)
        if ids is not None:
            queryset = queryset.filter(
                Q(usage_dialect_id__in=ids)
                | Q(pronunciation_variants__dialect_id__in=ids)
                | Q(recording_links__recording__usage_dialect_id__in=ids)
                | Q(
                    usage_attestations__dialect_id__in=ids,
                    usage_attestations__active=True,
                )
            )
        has_recording = parse_boolean(
            self.request.query_params.get("has_recording"), "has_recording"
        )
        if has_recording is not None:
            subquery = available_recording_links_for_user(self.request.user).filter(
                entry_id=OuterRef("pk")
            )
            queryset = queryset.annotate(
                has_available_recording=Exists(subquery)
            ).filter(has_available_recording=has_recording)
        ordering = self.request.query_params.get("ordering", "-updated_at")
        if ordering not in {
            "updated_at",
            "-updated_at",
            "created_at",
            "-created_at",
            "id",
            "-id",
        }:
            raise BadRequestException("不支持该 ordering")
        return queryset.distinct().order_by(ordering, "-id")


class EntrySenseViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch", "head", "options"]
    serializer_class = EntrySenseSerializer
    permission_classes = [V2ResourcePermission]

    def get_queryset(self):
        queryset = EntrySense.objects.filter(
            entry__in=visible_entries_for_user(self.request.user)
        ).select_related("entry", "entry__created_by", "created_by")
        queryset = queryset.prefetch_related(
            "entry__entry_writings__writing", "concept_links__concept"
        )
        for parameter, lookup in (
            ("entry_id", "entry_id"),
            ("status", "status"),
            ("concept", "concept_links__concept__code"),
        ):
            value = self.request.query_params.get(parameter)
            if value:
                queryset = queryset.filter(**{lookup: value})
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(gloss__icontains=search) | Q(usage_note__icontains=search)
            )
        return queryset.distinct()

    def perform_create(self, serializer):
        entry = serializer.validated_data["entry"]
        if not can_curate_entry(self.request.user, entry):
            raise PermissionDenied("只有贡献者或词条整理员可以补充该词条义项")
        serializer.save()


class WritingFormViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = WritingFormSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = WritingForm.objects.filter(
            entries__in=visible_entries_for_user(self.request.user)
        )
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(text__icontains=search) | Q(normalized_text__icontains=search)
            )
        form_type = self.request.query_params.get("form_type")
        if form_type:
            queryset = queryset.filter(form_type=form_type)
        return queryset.distinct()


class ConceptViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ConceptSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = Concept.objects.all()
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(code__icontains=search)
                | Q(label__icontains=search)
                | Q(definition__icontains=search)
            )
        return queryset


class PronunciationVariantViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch", "head", "options"]
    serializer_class = PronunciationVariantSerializer
    permission_classes = [V2ResourcePermission]

    def get_queryset(self):
        queryset = (
            PronunciationVariant.objects.filter(
                entry__in=visible_entries_for_user(self.request.user)
            )
            .select_related(
                "entry", "entry__created_by", "dialect", "dialect__parent", "created_by"
            )
            .prefetch_related("entry__entry_writings__writing")
        )
        for parameter in ("entry_id", "reading_type", "status"):
            value = self.request.query_params.get(parameter)
            if value:
                queryset = queryset.filter(**{parameter: value})
        ids = selected_dialect_ids(self.request)
        if ids is not None:
            queryset = queryset.filter(dialect_id__in=ids)
        ipa = self.request.query_params.get("ipa")
        if ipa:
            queryset = queryset.filter(ipa__icontains=ipa.strip())
        romanization = self.request.query_params.get("romanization")
        if romanization:
            queryset = queryset.filter(
                Q(base_romanization__icontains=romanization.strip())
                | Q(surface_romanization__icontains=romanization.strip())
            )
        return queryset

    def perform_create(self, serializer):
        entry = serializer.validated_data["entry"]
        dialect = serializer.validated_data["dialect"]
        if not (
            can_curate_entry(self.request.user, entry)
            or is_regional_curator(self.request.user, dialect)
        ):
            raise PermissionDenied("只有词条贡献者或相应整理员可以补充地区读音")
        serializer.save()


class RecordingViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]
    serializer_class = RecordingSerializer
    permission_classes = [V2ResourcePermission]

    def destroy(self, request, *args, **kwargs):
        raise MethodNotAllowed("DELETE")

    def retrieve(self, request, *args, **kwargs):
        from .restoration import recording_data

        return Response(recording_data(self.get_object(), request))

    @action(
        detail=True,
        methods=["put", "delete"],
        permission_classes=[permissions.IsAuthenticated],
    )
    @transaction.atomic
    def like(self, request, pk=None):
        from .restoration import recording_like

        return recording_like(self, request, pk)

    @action(detail=False, methods=["get"])
    def daily(self, request):
        from .restoration import discover_recording

        return discover_recording(self, request, daily=True)

    @action(detail=False, methods=["get"])
    def random(self, request):
        from .restoration import discover_recording

        return discover_recording(self, request)

    def response_queryset(self):
        return (
            visible_recordings_for_user(self.request.user)
            .select_related("usage_dialect", "usage_dialect__parent", "recorder")
            .prefetch_related(
                Prefetch(
                    "entry_links",
                    queryset=available_recording_links_for_user(self.request.user)
                    .filter(entry__in=visible_entries_for_user(self.request.user))
                    .select_related("sense", "entry")
                    .prefetch_related("entry__entry_writings__writing"),
                ),
            )
            .annotate(evidence_count=Count("evidence_links", distinct=True))
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        instance = self.response_queryset().get(pk=serializer.instance.pk)
        output = self.get_serializer(instance)
        return Response(
            output.data,
            status=status.HTTP_201_CREATED,
            headers=self.get_success_headers(output.data),
        )

    def update(self, request, *args, **kwargs):
        if request.method == "PUT":
            raise MethodNotAllowed("PUT")
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(
            self.get_serializer(self.response_queryset().get(pk=instance.pk)).data
        )

    def get_queryset(self):
        queryset = self.response_queryset()
        if parse_boolean(self.request.query_params.get("following"), "following"):
            from user.models import UserFollow

            if not self.request.user.is_authenticated:
                return queryset.none()
            queryset = queryset.filter(
                visibility=True,
                recorder_id__in=UserFollow.objects.filter(
                    follower=self.request.user
                ).values("followed_id"),
            )
        for parameter in ("recording_type", "status"):
            value = self.request.query_params.get(parameter)
            if value:
                queryset = queryset.filter(**{parameter: value})
        entry_id = self.request.query_params.get("entry_id")
        if entry_id:
            queryset = queryset.filter(
                entry_links__entry_id=entry_id,
                entry_links__is_current=True,
            )
        role = self.request.query_params.get("role")
        if role:
            queryset = queryset.filter(
                entry_links__role=role,
                entry_links__is_current=True,
            )
        ids = selected_dialect_ids(self.request)
        if ids is not None:
            queryset = queryset.filter(usage_dialect_id__in=ids)
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(original_gloss__icontains=search)
                | Q(entry_links__entry__summary__icontains=search)
                | Q(entry_links__entry__entry_writings__writing__text__icontains=search)
            )
        has_entry = parse_boolean(
            self.request.query_params.get("has_entry"), "has_entry"
        )
        if has_entry is not None:
            queryset = queryset.annotate(
                has_current_entry=Exists(
                    RecordingEntryLink.objects.filter(
                        recording_id=OuterRef("pk"), is_current=True
                    ).exclude(status=RecordingEntryLink.Status.REJECTED)
                )
            ).filter(has_current_entry=has_entry)
        return queryset.distinct().order_by("-created_at", "-id")


class RecordingEntryLinkViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "head", "options"]
    serializer_class = RecordingEntryLinkSerializer
    permission_classes = [V2ResourcePermission]

    def get_queryset(self):
        queryset = (
            RecordingEntryLink.objects.filter(
                recording__in=visible_recordings_for_user(self.request.user),
                entry__in=visible_entries_for_user(self.request.user),
            )
            .select_related(
                "recording",
                "recording__usage_dialect",
                "entry",
                "sense",
                "created_by",
                "reviewed_by",
            )
            .prefetch_related("entry__entry_writings__writing")
        )
        for parameter in ("recording_id", "entry_id", "role", "status"):
            value = self.request.query_params.get(parameter)
            if value:
                queryset = queryset.filter(**{parameter: value})
        current = parse_boolean(
            self.request.query_params.get("is_current"), "is_current"
        )
        if current is not None:
            queryset = queryset.filter(is_current=current)
        return queryset

    def perform_create(self, serializer):
        recording = serializer.validated_data["recording"]
        entry = serializer.validated_data["entry"]
        if not visible_entries_for_user(self.request.user).filter(pk=entry.pk).exists():
            raise PermissionDenied("不能关联不可见词条")
        if (
            not visible_recordings_for_user(self.request.user)
            .filter(pk=recording.pk)
            .exists()
        ):
            raise PermissionDenied("不能修改不可见录音")
        if not (
            can_curate_recording(self.request.user, recording)
            or can_curate_entry(self.request.user, entry)
        ):
            raise PermissionDenied("只有录制者、词条贡献者或整理员可以提出关联")
        serializer.save()


class UsageAttestationViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "delete", "head", "options"]
    serializer_class = UsageAttestationSerializer
    permission_classes = [V2ResourcePermission]

    def get_queryset(self):
        queryset = (
            UsageAttestation.objects.filter(
                entry__in=visible_entries_for_user(self.request.user)
            )
            .select_related(
                "entry", "entry__created_by", "dialect", "dialect__parent", "attester"
            )
            .prefetch_related("entry__entry_writings__writing")
        )
        if not (self.request.user and self.request.user.is_authenticated):
            queryset = queryset.filter(active=True)
        for parameter in ("entry_id", "dialect_id"):
            value = self.request.query_params.get(parameter)
            if value:
                queryset = queryset.filter(**{parameter: value})
        active = parse_boolean(self.request.query_params.get("active"), "active")
        if active is not None:
            queryset = queryset.filter(active=active)
        return queryset

    def perform_create(self, serializer):
        entry = serializer.validated_data["entry"]
        if not visible_entries_for_user(self.request.user).filter(pk=entry.pk).exists():
            raise PermissionDenied("不能确认不可见词条")
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        attestation = self.get_object()
        self.check_object_permissions(request, attestation)
        attestation.active = False
        attestation.save(update_fields=["active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class EvidenceRecordViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = EvidenceRecordSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        visible_entries = visible_entries_for_user(self.request.user)
        visible_recordings = visible_recordings_for_user(self.request.user)
        queryset = EvidenceRecord.objects.filter(
            Q(claim_links__entry__in=visible_entries)
            | Q(claim_links__sense__entry__in=visible_entries)
            | Q(claim_links__pronunciation_variant__entry__in=visible_entries)
            | Q(claim_links__recording__in=visible_recordings)
            | Q(claim_links__recording_entry_link__recording__in=visible_recordings)
        ).select_related("contributor")
        source_type = self.request.query_params.get("source_type")
        if source_type:
            queryset = queryset.filter(source_type=source_type)
        entry_id = self.request.query_params.get("entry_id")
        if entry_id:
            queryset = queryset.filter(
                Q(claim_links__entry_id=entry_id)
                | Q(claim_links__sense__entry_id=entry_id)
                | Q(claim_links__pronunciation_variant__entry_id=entry_id)
                | Q(claim_links__recording_entry_link__entry_id=entry_id)
            )
        recording_id = self.request.query_params.get("recording_id")
        if recording_id:
            queryset = queryset.filter(
                Q(claim_links__recording_id=recording_id)
                | Q(claim_links__recording_entry_link__recording_id=recording_id)
            )
        return queryset.distinct()


class LegacyReviewCandidateViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LegacyReviewCandidateSerializer
    permission_classes = [IsLexicalCurator]

    def get_queryset(self):
        queryset = LegacyReviewCandidate.objects.select_related(
            "primary_entry"
        ).prefetch_related("entries__entry_writings__writing")
        for parameter in ("candidate_type", "status", "source_system"):
            value = self.request.query_params.get(parameter)
            if value:
                queryset = queryset.filter(**{parameter: value})
        return queryset


class CurationView(APIView):
    permission_classes = [IsActiveCurator]

    def get(self, request):
        grants = active_curator_grants(request.user)
        candidates = LegacyReviewCandidate.objects.filter(
            status=LegacyReviewCandidate.Status.PENDING
        )
        pending_links = RecordingEntryLink.objects.filter(
            status__in=[
                RecordingEntryLink.Status.SUGGESTED,
                RecordingEntryLink.Status.DISPUTED,
            ],
            is_current=True,
        )
        pending_senses = EntrySense.objects.filter(
            status__in=[EntrySense.Status.DRAFT, EntrySense.Status.DISPUTED]
        )
        pending_variants = PronunciationVariant.objects.filter(
            status__in=[
                PronunciationVariant.Status.DRAFT,
                PronunciationVariant.Status.DISPUTED,
            ]
        )
        pending_entries = Entry.objects.filter(
            status__in=[Entry.Status.DRAFT, Entry.Status.DISPUTED]
        )
        pending_recordings = Recording.objects.filter(
            status__in=[Recording.Status.DRAFT, Recording.Status.DISPUTED]
        )
        disputed_entries = Entry.objects.filter(status=Entry.Status.DISPUTED)
        disputed_recordings = Recording.objects.filter(status=Recording.Status.DISPUTED)
        disputed_recording_links = RecordingEntryLink.objects.filter(
            status=RecordingEntryLink.Status.DISPUTED,
            is_current=True,
        )
        is_lexical = (
            request.user.is_staff
            or grants.filter(role=CuratorGrant.Role.LEXICAL).exists()
        )
        regional_ids = regional_curator_scope_ids(request.user)
        if not is_lexical:
            candidates = candidates.none()
            pending_entries = pending_entries.none()
            pending_senses = pending_senses.none()
            disputed_entries = disputed_entries.filter(
                Q(usage_dialect_id__in=regional_ids)
                | Q(recording_links__recording__usage_dialect_id__in=regional_ids)
            ).distinct()
        if not request.user.is_staff:
            pending_recordings = pending_recordings.filter(
                usage_dialect_id__in=regional_ids
            )
            pending_variants = pending_variants.filter(dialect_id__in=regional_ids)
            pending_links = pending_links.filter(
                recording__usage_dialect_id__in=regional_ids
            )
            disputed_recordings = disputed_recordings.filter(
                usage_dialect_id__in=regional_ids
            )
            disputed_recording_links = disputed_recording_links.filter(
                recording__usage_dialect_id__in=regional_ids
            )
        return Response(
            {
                "grants": CuratorGrantSerializer(grants, many=True).data,
                "pending": {
                    "legacy_candidates": candidates.count(),
                    "entries": pending_entries.count(),
                    "senses": pending_senses.count(),
                    "recordings": pending_recordings.count(),
                    "pronunciations": pending_variants.count(),
                    "recording_links": pending_links.count(),
                    # Compatibility aliases for clients on the first V2 API.
                    "disputed_entries": disputed_entries.count(),
                    "disputed_recordings": disputed_recordings.count(),
                    "disputed_recording_links": disputed_recording_links.count(),
                },
            }
        )


class CuratorGrantViewSet(viewsets.ReadOnlyModelViewSet):
    """Public, time-bounded grant directory; Django admin remains separate."""

    serializer_class = CuratorGrantSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = CuratorGrant.objects.select_related(
            "user", "user__user_info", "dialect", "granted_by", "granted_by__user_info"
        )
        role = self.request.query_params.get("role")
        if role:
            queryset = queryset.filter(role=role)
        user_id = self.request.query_params.get("user_id")
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        active = parse_boolean(self.request.query_params.get("active"), "active")
        if active is True:
            now = timezone.now()
            queryset = queryset.filter(
                revoked_at__isnull=True,
                valid_from__lte=now,
                valid_until__gt=now,
            )
        elif active is False:
            now = timezone.now()
            queryset = queryset.filter(
                Q(revoked_at__isnull=False)
                | Q(valid_from__gt=now)
                | Q(valid_until__lte=now)
            )
        return queryset


class CuratorApplicationViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "delete", "head", "options"]
    serializer_class = CuratorApplicationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = CuratorApplication.objects.select_related(
            "applicant",
            "applicant__user_info",
            "dialect",
            "reviewed_by",
            "reviewed_by__user_info",
        )
        if not self.request.user.is_staff:
            queryset = queryset.filter(applicant=self.request.user)
        status_value = self.request.query_params.get("status")
        return queryset.filter(status=status_value) if status_value else queryset

    def destroy(self, request, *args, **kwargs):
        application = self.get_object()
        if application.applicant_id != request.user.id:
            raise PermissionDenied("只能撤回自己的申请")
        if application.status != CuratorApplication.Status.PENDING:
            raise BadRequestException("只能撤回待审申请")
        application.status = CuratorApplication.Status.WITHDRAWN
        application.save(update_fields=["status", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def review(self, request, pk=None):
        if not request.user.is_staff:
            raise PermissionDenied("只有已授权管理员可审核整理员申请")
        review = CuratorApplicationReviewSerializer(data=request.data)
        review.is_valid(raise_exception=True)
        with transaction.atomic():
            application = CuratorApplication.objects.select_for_update().get(pk=pk)
            if application.status != CuratorApplication.Status.PENDING:
                raise BadRequestException("该申请已处理")
            now = timezone.now()
            application.status = review.validated_data["decision"]
            application.reviewed_by = request.user
            application.review_reason = review.validated_data["reason"].strip()
            application.reviewed_at = now
            application.save(
                update_fields=[
                    "status",
                    "reviewed_by",
                    "review_reason",
                    "reviewed_at",
                    "updated_at",
                ]
            )
            grant = None
            if application.status == CuratorApplication.Status.APPROVED:
                grant = CuratorGrant.objects.create(
                    user=application.applicant,
                    role=application.role,
                    dialect=application.dialect,
                    valid_from=now,
                    valid_until=now
                    + timedelta(days=review.validated_data["valid_days"]),
                    granted_by=request.user,
                    reason=application.review_reason,
                )
        payload = self.get_serializer(application).data
        payload["grant"] = CuratorGrantSerializer(grant).data if grant else None
        return Response(payload)


class CurationActionViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [CurationHistoryPermission]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["visible_evidence"] = visible_evidence_for_user(self.request.user)
        return context

    def get_serializer_class(self):
        return (
            CurationActionRequestSerializer
            if self.action == "create"
            else CurationActionSerializer
        )

    def get_queryset(self):
        queryset = CurationAction.objects.select_related(
            "actor", "actor__user_info", "grant", "grant__dialect"
        ).prefetch_related("evidence")
        queryset = history_for_user(
            queryset,
            self.request.user,
            visible_entries_for_user(self.request.user),
            visible_recordings_for_user(self.request.user),
        )
        for parameter in ("action_type", "target_type", "target_id"):
            value = self.request.query_params.get(parameter)
            if value:
                queryset = queryset.filter(**{parameter: value})
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action_record = perform_curation_action(request.user, serializer.validated_data)
        output = CurationActionSerializer(action_record, context={"request": request})
        return Response(output.data, status=status.HTTP_201_CREATED)


def _task_dialect(dialect):
    return DialectRefSerializer(dialect).data if dialect else None


class CurationTaskView(APIView):
    permission_classes = [IsActiveCurator]

    def get(self, request):
        kind_filter = request.query_params.get("kind", "")
        try:
            limit = min(max(int(request.query_params.get("limit", 40)), 1), 100)
        except (TypeError, ValueError):
            raise BadRequestException("limit 必须是 1 到 100 的整数")
        tasks = []

        def add(kind, obj_id, title, summary, target_type, dialect=None, actions=None):
            if kind_filter and kind_filter != kind:
                return
            tasks.append(
                {
                    "kind": kind,
                    "id": obj_id,
                    "title": title,
                    "summary": summary,
                    "target_type": target_type,
                    "dialect": _task_dialect(dialect),
                    "actions": actions or ["reviewed", "disputed"],
                }
            )

        grants = active_curator_grants(request.user)
        lexical = (
            request.user.is_staff
            or grants.filter(role=CuratorGrant.Role.LEXICAL).exists()
        )
        regional_ids = regional_curator_scope_ids(request.user)
        if lexical:
            for item in LegacyReviewCandidate.objects.filter(
                status=LegacyReviewCandidate.Status.PENDING
            ).select_related("primary_entry")[:limit]:
                add(
                    "legacy_candidate",
                    item.id,
                    item.get_candidate_type_display(),
                    item.candidate_key,
                    CurationAction.TargetType.LEGACY_CANDIDATE,
                    actions=["accepted", "rejected"],
                )
            for entry in Entry.objects.filter(
                status__in=[Entry.Status.DRAFT, Entry.Status.DISPUTED]
            ).select_related("usage_dialect")[:limit]:
                add(
                    "entry",
                    entry.id,
                    str(entry),
                    entry.summary or "待补充大意",
                    CurationAction.TargetType.ENTRY,
                    entry.usage_dialect,
                )
            for sense in EntrySense.objects.filter(
                status__in=[EntrySense.Status.DRAFT, EntrySense.Status.DISPUTED]
            ).select_related("entry", "entry__usage_dialect")[:limit]:
                add(
                    "sense",
                    sense.id,
                    f"义项 {sense.sense_number}",
                    sense.gloss,
                    CurationAction.TargetType.SENSE,
                    sense.entry.usage_dialect,
                )
        if regional_ids or request.user.is_staff:
            recordings = Recording.objects.filter(
                status__in=[Recording.Status.DRAFT, Recording.Status.DISPUTED]
            ).select_related("usage_dialect")
            variants = PronunciationVariant.objects.filter(
                status__in=[
                    PronunciationVariant.Status.DRAFT,
                    PronunciationVariant.Status.DISPUTED,
                ]
            ).select_related("dialect", "entry")
            links = RecordingEntryLink.objects.filter(
                status__in=[
                    RecordingEntryLink.Status.SUGGESTED,
                    RecordingEntryLink.Status.DISPUTED,
                ],
                is_current=True,
            ).select_related("recording__usage_dialect", "entry")
            if not request.user.is_staff:
                recordings = recordings.filter(usage_dialect_id__in=regional_ids)
                variants = variants.filter(dialect_id__in=regional_ids)
                links = links.filter(recording__usage_dialect_id__in=regional_ids)
            for recording in recordings[:limit]:
                add(
                    "recording",
                    recording.id,
                    recording.original_gloss or f"录音 {recording.id}",
                    "核对地区范围、原始大意与授权",
                    CurationAction.TargetType.RECORDING,
                    recording.usage_dialect,
                    ["published", "disputed", "rejected"],
                )
            for variant in variants[:limit]:
                add(
                    "pronunciation",
                    variant.id,
                    str(variant),
                    "核对 IPA、罗马字和地区范围",
                    CurationAction.TargetType.PRONUNCIATION,
                    variant.dialect,
                    ["reviewed", "disputed", "rejected"],
                )
            for link in links[:limit]:
                add(
                    "recording_link",
                    link.id,
                    f"录音 {link.recording_id} ↔ {str(link.entry)}",
                    link.get_role_display(),
                    CurationAction.TargetType.RECORDING_LINK,
                    link.recording.usage_dialect,
                    ["accepted", "disputed", "rejected"],
                )
        return Response({"count": len(tasks), "results": tasks[:limit]})


class MyContributionHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        recordings = Recording.objects.filter(recorder=user).select_related(
            "usage_dialect"
        )
        evidence = EvidenceRecord.objects.filter(contributor=user)
        actions = CurationAction.objects.filter(actor=user)
        attestations = UsageAttestation.objects.filter(
            attester=user, active=True
        ).select_related("dialect", "entry")

        dialect_counts = {}
        dialect_objects = {}
        for recording in recordings:
            dialect_counts[recording.usage_dialect_id] = (
                dialect_counts.get(recording.usage_dialect_id, 0) + 1
            )
            dialect_objects[recording.usage_dialect_id] = recording.usage_dialect
        for attestation in attestations:
            dialect_counts[attestation.dialect_id] = (
                dialect_counts.get(attestation.dialect_id, 0) + 1
            )
            dialect_objects[attestation.dialect_id] = attestation.dialect
        footprint = [
            {
                "dialect": _task_dialect(dialect_objects[dialect_id]),
                "contribution_count": count,
            }
            for dialect_id, count in sorted(
                dialect_counts.items(), key=lambda item: (-item[1], item[0])
            )
        ]

        events = []
        for recording in recordings.order_by("-created_at")[:20]:
            events.append(
                {
                    "kind": "recording",
                    "label": recording.original_gloss or f"录音 {recording.id}",
                    "created_at": recording.created_at,
                    "target_id": recording.id,
                }
            )
        for record in evidence.order_by("-created_at")[:20]:
            events.append(
                {
                    "kind": "evidence",
                    "label": record.original_writing
                    or record.original_gloss
                    or record.citation
                    or f"依据 {record.id}",
                    "created_at": record.created_at,
                    "target_id": record.id,
                }
            )
        for action_record in actions.order_by("-created_at")[:20]:
            events.append(
                {
                    "kind": "revision",
                    "label": action_record.target_label
                    or action_record.get_action_type_display(),
                    "created_at": action_record.created_at,
                    "target_id": action_record.id,
                }
            )
        for attestation in attestations.order_by("-attested_at")[:20]:
            events.append(
                {
                    "kind": "attestation",
                    "label": f"{str(attestation.entry)} · {attestation.dialect.name}",
                    "created_at": attestation.attested_at,
                    "target_id": attestation.id,
                }
            )
        events.sort(key=lambda item: item["created_at"], reverse=True)
        for event in events:
            event["created_at"] = event["created_at"].isoformat()
        return Response(
            {
                "summary": {
                    "recordings": recordings.count(),
                    "evidence": evidence.count(),
                    "revisions": actions.count(),
                    "dialects": len(footprint),
                },
                "dialect_footprint": footprint,
                "recent_activity": events[:40],
            }
        )
