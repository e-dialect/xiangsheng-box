from guantou.legacy_import import SOURCE_SYSTEM
from guantou.models import Entry, LegacyImportRecord
from guantou.v2_views import visible_entries_for_user, visible_recordings_for_user

from .models import MaterialPack


def fields(data, *names):
    return {name: data[name] for name in names if name in data}


def project_content(kind, payload):
    """Build the visible payload from the documented fields."""
    if kind == MaterialPack.Kind.PINYIN:
        return {
            "sections": [
                {
                    **fields(section, "title", "text"),
                    "rows": [
                        fields(
                            row,
                            "form",
                            "ipa",
                            "example",
                            "entry_id",
                            "recording_id",
                            "hinghwa_word_id",
                        )
                        for row in section.get("rows", [])
                    ],
                }
                for section in payload["sections"]
            ],
            "sound_rows": [
                fields(
                    row,
                    "character",
                    "form",
                    "initial",
                    "final",
                    "tone",
                    "entry_id",
                    "recording_id",
                    "hinghwa_word_id",
                )
                for row in payload.get("sound_rows", [])
            ],
        }
    if kind == MaterialPack.Kind.QUIZ:
        return {
            "questions": [
                fields(question, "prompt", "options", "answer", "explanation")
                for question in payload["questions"]
            ]
        }
    return {
        "selfId": payload["selfId"],
        "nodes": [
            {
                **fields(node, "id", "label", "sex", "kind", "relations"),
                "terms": [
                    fields(term, "text", "usage", "entry_id", "recording_id")
                    for term in node.get("terms", [])
                ],
            }
            for node in payload["nodes"]
        ],
    }


def public_material(revision):
    kind = revision.pack.kind
    payload = project_content(kind, revision.payload)
    references = []
    if kind == MaterialPack.Kind.PINYIN:
        references = [row for section in payload["sections"] for row in section["rows"]]
        references.extend(payload["sound_rows"])
        legacy_ids = {
            str(row["hinghwa_word_id"])
            for row in references
            if type(row.get("hinghwa_word_id")) is int
        }
        entries = dict(
            LegacyImportRecord.objects.filter(
                source_system=SOURCE_SYSTEM,
                source_table="word_word",
                target_model=Entry._meta.label,
                source_id__in=legacy_ids,
            ).values_list("source_id", "target_id")
        )
        for row in references:
            legacy_id = row.pop("hinghwa_word_id", None)
            if (
                type(legacy_id) is int
                and not row.get("entry_id")
                and str(legacy_id) in entries
            ):
                row["entry_id"] = entries[str(legacy_id)]
    elif kind == MaterialPack.Kind.KINSHIP:
        references = [term for node in payload["nodes"] for term in node["terms"]]

    for key, visible in (
        ("entry_id", visible_entries_for_user),
        ("recording_id", visible_recordings_for_user),
    ):
        requested = {item[key] for item in references if item.get(key)}
        public_ids = set(
            visible(None).filter(id__in=requested).values_list("pk", flat=True)
        )
        for item in references:
            if item.get(key) not in public_ids:
                item.pop(key, None)

    return {
        "version": revision.version,
        "title": revision.title,
        "accent": revision.accent,
        "source": revision.source,
        "source_url": revision.source_url,
        "content": payload,
    }
