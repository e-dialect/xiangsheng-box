from guantou.models import Entry, Recording

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
                            row, "form", "ipa", "example", "entry_id", "recording_id"
                        )
                        for row in section.get("rows", [])
                    ],
                }
                for section in payload["sections"]
            ]
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
    elif kind == MaterialPack.Kind.KINSHIP:
        references = [term for node in payload["nodes"] for term in node["terms"]]

    for key, model in (("entry_id", Entry), ("recording_id", Recording)):
        requested = {item[key] for item in references if item.get(key)}
        public_ids = set(
            model.objects.filter(id__in=requested, visibility=True).values_list(
                "pk", flat=True
            )
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
