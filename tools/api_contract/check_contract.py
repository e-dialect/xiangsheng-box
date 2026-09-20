#!/usr/bin/env python3
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend" / "guantou"
OPENAPI = ROOT / "docs" / "api" / "v1" / "openapi.yaml"
HTTP_METHODS = {"get", "post", "put", "patch", "delete", "head", "options"}

RESOURCE_CONTRACTS = (
    {
        "prefix": "entries",
        "list_path": "/entries/",
        "detail_path": "/entries/{entry_id}/",
        "list_methods": {"get", "post"},
        "detail_methods": {"get", "patch"},
        "serializer": "EntrySerializer",
        "schema": "EntryV2",
        "fields": {
            "id",
            "display_writing",
            "summary",
            "usage_dialect",
            "status",
            "recording_count",
            "needs_audio",
        },
    },
    {
        "prefix": "entry-senses",
        "list_path": "/entry-senses/",
        "detail_path": "/entry-senses/{sense_id}/",
        "list_methods": {"get", "post"},
        "detail_methods": {"get", "patch"},
        "serializer": "EntrySenseSerializer",
        "schema": "EntrySenseV2",
        "fields": {"id", "entry", "sense_number", "gloss", "status", "concepts"},
    },
    {
        "prefix": "pronunciation-variants",
        "list_path": "/pronunciation-variants/",
        "detail_path": "/pronunciation-variants/{variant_id}/",
        "list_methods": {"get", "post"},
        "detail_methods": {"get", "patch"},
        "serializer": "PronunciationVariantSerializer",
        "schema": "PronunciationVariantV2",
        "fields": {
            "id",
            "entry",
            "dialect",
            "ipa",
            "base_romanization",
            "surface_romanization",
            "status",
        },
    },
    {
        "prefix": "recordings",
        "list_path": "/recordings/",
        "detail_path": "/recordings/{recording_id}/",
        "list_methods": {"get", "post"},
        "detail_methods": {"get", "patch"},
        "serializer": "RecordingSerializer",
        "schema": "RecordingV2",
        "fields": {
            "id",
            "audio_url",
            "usage_dialect",
            "original_gloss",
            "status",
            "entry_links",
        },
    },
    {
        "prefix": "recording-entry-links",
        "list_path": "/recording-entry-links/",
        "detail_path": "/recording-entry-links/{link_id}/",
        "list_methods": {"get", "post"},
        "detail_methods": {"get"},
        "serializer": "RecordingEntryLinkSerializer",
        "schema": "RecordingEntryLinkV2",
        "fields": {"id", "entry", "role", "status", "is_current"},
    },
    {
        "prefix": "usage-attestations",
        "list_path": "/usage-attestations/",
        "detail_path": "/usage-attestations/{attestation_id}/",
        "list_methods": {"get", "post"},
        "detail_methods": {"get", "delete"},
        "serializer": "UsageAttestationSerializer",
        "schema": "UsageAttestationV2",
        "fields": {"id", "entry", "dialect", "attester", "active"},
    },
    {
        "prefix": "evidence-records",
        "list_path": "/evidence-records/",
        "detail_path": "/evidence-records/{evidence_id}/",
        "list_methods": {"get"},
        "detail_methods": {"get"},
        "serializer": "EvidenceRecordSerializer",
        "schema": "EvidenceRecordV2",
        "fields": {
            "id",
            "source_type",
            "original_text",
            "original_writing",
            "original_gloss",
            "citation",
        },
    },
    {
        "prefix": "curator-grants",
        "list_path": "/curator-grants/",
        "detail_path": "/curator-grants/{grant_id}/",
        "list_methods": {"get"},
        "detail_methods": {"get"},
        "serializer": "CuratorGrantSerializer",
        "schema": "CuratorGrantV2",
        "fields": {
            "id",
            "user",
            "role",
            "dialect",
            "valid_from",
            "valid_until",
            "reason",
            "is_active",
        },
    },
    {
        "prefix": "curator-applications",
        "list_path": "/curator-applications/",
        "detail_path": "/curator-applications/{application_id}/",
        "list_methods": {"get", "post"},
        "detail_methods": {"get", "delete"},
        "serializer": "CuratorApplicationSerializer",
        "schema": "CuratorApplicationV2",
        "fields": {
            "id",
            "applicant",
            "role",
            "dialect",
            "statement",
            "experience",
            "status",
            "review_reason",
        },
    },
    {
        "prefix": "curation/actions",
        "list_path": "/curation/actions/",
        "detail_path": "/curation/actions/{action_id}/",
        "list_methods": {"get", "post"},
        "detail_methods": {"get"},
        "serializer": "CurationActionSerializer",
        "schema": "CurationActionV2",
        "fields": {
            "id",
            "actor",
            "action_type",
            "target_type",
            "target_id",
            "before_snapshot",
            "after_snapshot",
            "reason",
            "evidence_ids",
        },
    },
)

COMMENT_FIELDS = {
    "id",
    "recording_id",
    "entry_id",
    "parent_id",
    "body",
    "author_name",
    "author_id",
    "created_at",
    "reply_to_id",
    "reply_to_author_name",
    "reply_count",
    "recent_replies",
    "deleted",
    "like_count",
    "liked",
    "editable",
}

COMMENT_CONTRACTS = (
    {
        "serializer": "CommentSerializer",
        "schema": "RecordingComment",
        "fields": COMMENT_FIELDS,
    },
    {
        "serializer": "CommentSerializer",
        "schema": "EntryComment",
        "fields": COMMENT_FIELDS,
    },
    {
        "serializer": "CommentReplySerializer",
        "schema": "CommentReply",
        "fields": {
            "id",
            "parent_id",
            "body",
            "author_name",
            "author_id",
            "created_at",
            "reply_to_id",
            "reply_to_author_name",
            "like_count",
            "liked",
            "editable",
        },
    },
)

COLLECTION_FIELDS = {
    "id",
    "title",
    "description",
    "is_public",
    "owner_id",
    "created_at",
    "updated_at",
}

COLLECTION_SECTION_FIELDS = {
    "id",
    "entry",
    "recordings",
    "recording_count",
    "created_at",
}

COLLECTED_RECORDING_FIELDS = {
    "id",
    "recording",
    "needs_review",
    "created_at",
}

RETIRED_CORE_PREFIXES = {
    "packages",
    "flavors",
    "pronunciations",
    "cans",
    "nameplates",
    "shelves",
    "posts",
    "comments",
}

RETIRED_CORE_PATHS = {
    "/packages/",
    "/flavors/",
    "/pronunciations/",
    "/cans/",
    "/nameplates/",
    "/shelves/",
    "/posts/",
    "/comments/",
    "/daily/",
    "/discovery/",
    "/search/",
    "/search/suggest/",
    "/search/hot/",
}

AUXILIARY_V2_PATHS = {
    "/collections/": {"get", "post"},
    "/collections/{collection_id}/": {"get", "patch", "delete"},
    "/collections/{collection_id}/entries/": {"post"},
    "/collections/{collection_id}/recordings/": {"post"},
    "/collections/{collection_id}/entries/{item_id}/": {"delete"},
    "/collections/{collection_id}/recordings/{item_id}/": {"delete"},
    "/collections/{collection_id}/order/": {"post"},
    "/entries/suggestions/": {"get"},
    "/entries/popular/": {"get"},
    "/recordings/daily/": {"get"},
    "/recordings/random/": {"get"},
    "/recordings/{recording_id}/like/": {"put", "delete"},
    "/entry-comments/": {"get", "post"},
    "/entry-comments/{comment_id}/": {"delete"},
    "/entry-comments/{comment_id}/like/": {"put", "delete"},
    "/recording-comments/": {"get", "post"},
    "/recording-comments/{comment_id}/": {"delete"},
    "/recording-comments/{comment_id}/like/": {"put", "delete"},
    "/curation/": {"get"},
    "/curation/tasks/": {"get"},
    "/curator-applications/{application_id}/review/": {"post"},
    "/contributions/me/": {"get"},
}

PLATFORM_PATHS = {
    "/site-settings/capabilities": {"get"},
    "/product-events/": {"post"},
}

PLATFORM_SCHEMAS = {
    "CapabilitySwitches": {
        "listen_feed",
        "entry_search",
        "recording",
        "usage_attestation",
        "curation_workbench",
        "wechat_auth",
    },
    "ProductEventWrite": {
        "session_id",
        "event_name",
        "platform",
        "surface",
        "result",
        "metadata",
    },
}


def parse_openapi(path=OPENAPI):
    paths = {}
    schemas = {}
    schema_parents = {}
    section = None
    current_path = None
    current_schema = None
    properties_indent = None
    for line in path.read_text(encoding="utf-8").splitlines():
        if line == "paths:":
            section = "paths"
            continue
        if line == "components:":
            section = "components"
            current_path = None
            continue
        if section == "paths":
            match = re.match(r"^  (/[^:]+):\s*$", line)
            if match:
                current_path = match.group(1)
                paths[current_path] = set()
                continue
            match = re.match(r"^    ([a-z]+):\s*$", line)
            if current_path and match and match.group(1) in HTTP_METHODS:
                paths[current_path].add(match.group(1))
        elif section == "components":
            match = re.match(r"^    ([A-Za-z][A-Za-z0-9]*):\s*$", line)
            if match:
                current_schema = match.group(1)
                schemas[current_schema] = set()
                schema_parents[current_schema] = set()
                properties_indent = None
                continue
            parent_match = re.match(
                r'^        - \$ref: "#/components/schemas/([A-Za-z][A-Za-z0-9]*)"$',
                line,
            )
            if current_schema and parent_match:
                schema_parents[current_schema].add(parent_match.group(1))
            indent = len(line) - len(line.lstrip(" "))
            if current_schema and line.strip() == "properties:" and indent in {6, 10}:
                properties_indent = indent
                continue
            if properties_indent is not None:
                match = re.match(
                    rf"^ {{{properties_indent + 2}}}([A-Za-z_][A-Za-z0-9_]*):",
                    line,
                )
                if match:
                    schemas[current_schema].add(match.group(1))
                elif line and indent <= properties_indent:
                    properties_indent = None
    return paths, schemas, schema_parents


def expanded_schema_fields(name, schemas, schema_parents, visited=None):
    visited = set(visited or ())
    if name in visited:
        return set()
    visited.add(name)
    fields = set(schemas.get(name, set()))
    for parent in schema_parents.get(name, set()):
        fields.update(expanded_schema_fields(parent, schemas, schema_parents, visited))
    return fields


def contract_errors():
    sys.path.insert(0, str(BACKEND))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    import django

    django.setup()
    from guantou.urls import router
    from guantou import v2_serializers
    from guantou import restoration

    paths, schemas, schema_parents = parse_openapi()
    registered = {prefix: viewset for prefix, viewset, _ in router.registry}
    errors = []

    for prefix in sorted(RETIRED_CORE_PREFIXES & registered.keys()):
        errors.append(f"DRF router 仍公开旧核心资源: {prefix}")
    for path in sorted(RETIRED_CORE_PATHS & paths.keys()):
        errors.append(f"OpenAPI 仍记录已退役路径: {path}")

    for spec in RESOURCE_CONTRACTS:
        viewset = registered.get(spec["prefix"])
        if viewset is None:
            errors.append(f"DRF router 缺少资源: {spec['prefix']}")
            continue
        implementation_methods = set(getattr(viewset, "http_method_names", []))
        expected_methods = spec["list_methods"] | spec["detail_methods"]
        missing_implementation = expected_methods - implementation_methods
        if missing_implementation:
            errors.append(
                f"实现资源 {spec['prefix']} 缺少方法: {sorted(missing_implementation)}"
            )
        for key in ("list", "detail"):
            path = spec[f"{key}_path"]
            expected = spec[f"{key}_methods"]
            missing = expected - paths.get(path, set())
            if missing:
                errors.append(f"OpenAPI 路径 {path} 缺少方法: {sorted(missing)}")

        serializer_class = getattr(v2_serializers, spec["serializer"])
        implementation_fields = set(serializer_class().fields)
        missing_serializer_fields = spec["fields"] - implementation_fields
        if missing_serializer_fields:
            errors.append(
                f"序列化器 {spec['serializer']} 缺少核心字段: "
                f"{sorted(missing_serializer_fields)}"
            )
        contract_fields = expanded_schema_fields(
            spec["schema"], schemas, schema_parents
        )
        missing_contract_fields = spec["fields"] - contract_fields
        if missing_contract_fields:
            errors.append(
                f"OpenAPI schema {spec['schema']} 缺少核心字段: "
                f"{sorted(missing_contract_fields)}"
            )
    for spec in COMMENT_CONTRACTS:
        serializer_class = getattr(restoration, spec["serializer"])
        implementation_fields = set(serializer_class().fields)
        missing_serializer_fields = spec["fields"] - implementation_fields
        if missing_serializer_fields:
            errors.append(
                f"序列化器 {spec['serializer']} 缺少核心字段: "
                f"{sorted(missing_serializer_fields)}"
            )
        contract_fields = expanded_schema_fields(
            spec["schema"], schemas, schema_parents
        )
        missing_contract_fields = spec["fields"] - contract_fields
        if missing_contract_fields:
            errors.append(
                f"OpenAPI schema {spec['schema']} 缺少核心字段: "
                f"{sorted(missing_contract_fields)}"
            )
    collection_serializer_fields = set(restoration.CollectionSerializer().fields)
    missing_collection_serializer = COLLECTION_FIELDS - collection_serializer_fields
    if missing_collection_serializer:
        errors.append(
            "序列化器 CollectionSerializer 缺少核心字段: "
            f"{sorted(missing_collection_serializer)}"
        )
    missing_collection_schema = COLLECTION_FIELDS - expanded_schema_fields(
        "Collection", schemas, schema_parents
    )
    if missing_collection_schema:
        errors.append(
            "OpenAPI schema Collection 缺少核心字段: "
            f"{sorted(missing_collection_schema)}"
        )
    for schema, required in (
        ("CollectionSection", COLLECTION_SECTION_FIELDS),
        ("CollectedRecording", COLLECTED_RECORDING_FIELDS),
    ):
        missing_schema_fields = required - expanded_schema_fields(
            schema, schemas, schema_parents
        )
        if missing_schema_fields:
            errors.append(
                f"OpenAPI schema {schema} 缺少核心字段: "
                f"{sorted(missing_schema_fields)}"
            )
    for path, methods in AUXILIARY_V2_PATHS.items():
        missing = methods - paths.get(path, set())
        if missing:
            errors.append(f"OpenAPI V2 辅助路径 {path} 缺少方法: {sorted(missing)}")
    for path, methods in PLATFORM_PATHS.items():
        missing = methods - paths.get(path, set())
        if missing:
            errors.append(f"OpenAPI 平台路径 {path} 缺少方法: {sorted(missing)}")
    for schema, required_fields in PLATFORM_SCHEMAS.items():
        missing = required_fields - expanded_schema_fields(
            schema, schemas, schema_parents
        )
        if missing:
            errors.append(f"OpenAPI schema {schema} 缺少核心字段: {sorted(missing)}")
    return errors


def main():
    errors = contract_errors()
    if errors:
        print("API contract drift detected:")
        for error in errors:
            print(f"- {error}")
        return 1
    print(
        "API contract check passed: retired core routes are absent and "
        "Entry/Recording V2 governance, capability, and analytics routes, "
        "methods, and core serializer fields are aligned."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
