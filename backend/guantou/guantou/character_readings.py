"""A public lookup by exact written character, independent of the viewer."""

import unicodedata
from collections import defaultdict

from django.db.models import Prefetch, Q
from rest_framework.exceptions import ValidationError

from .models import (
    Entry,
    EntryWriting,
    EvidenceLink,
    PronunciationVariant,
    Recording,
    RecordingEntryLink,
)


def character_kind(char):
    if char == "〇" or unicodedata.name(char, "").startswith(
        ("CJK UNIFIED IDEOGRAPH", "CJK COMPATIBILITY IDEOGRAPH")
    ):
        return "han"
    return (
        "separator"
        if char.isspace() or unicodedata.category(char).startswith("P")
        else "other"
    )


def lookup_characters(text, public_entries):
    if not text.strip() or len(text) > 32:
        raise ValidationError({"text": "请输入 1 至 32 个字符"})

    characters = {char for char in text if character_kind(char) == "han"}
    public_statuses = (Entry.Status.REVIEWED, Entry.Status.DISPUTED)
    writings = EntryWriting.objects.filter(
        is_current=True, status__in=public_statuses
    ).select_related("writing")
    variants = (
        PronunciationVariant.objects.filter(status__in=public_statuses)
        .select_related("dialect")
        .prefetch_related(
            Prefetch(
                "evidence_links",
                queryset=EvidenceLink.objects.select_related("evidence"),
            )
        )
    )
    recordings = (
        RecordingEntryLink.objects.filter(
            is_current=True,
            status=RecordingEntryLink.Status.ACCEPTED,
            recording__visibility=True,
            recording__status=Recording.Status.PUBLISHED,
            recording__publication_consent="public-display-v1",
        )
        .filter(Q(recording__media__isnull=False) | ~Q(recording__audio_url=""))
        .select_related("recording__usage_dialect")
    )
    entries = (
        public_entries.filter(
            status__in=public_statuses,
            pk__in=writings.filter(writing__text__in=characters).values("entry_id"),
        )
        .prefetch_related(
            Prefetch("entry_writings", queryset=writings),
            Prefetch("pronunciation_variants", queryset=variants),
            Prefetch("recording_links", queryset=recordings),
        )
        .order_by("id")
    )

    by_character = defaultdict(list)
    for entry in entries:
        spellings = list(
            dict.fromkeys(link.writing.text for link in entry.entry_writings.all())
        )
        recordings_by_id = {
            link.recording_id: link.recording for link in entry.recording_links.all()
        }
        item = {
            "id": entry.id,
            "summary": entry.summary,
            "writings": spellings,
            "status": entry.status,
            "readings": [
                {
                    "id": variant.id,
                    "district": variant.dialect.name,
                    "ipa": variant.ipa,
                    "base_romanization": variant.base_romanization,
                    "surface_romanization": variant.surface_romanization,
                    "reading_type": variant.reading_type,
                    "usage_note": variant.usage_note,
                    "status": variant.status,
                    "sources": [
                        {
                            "id": link.evidence_id,
                            "relation": link.get_relation_type_display(),
                            "citation": link.evidence.citation
                            or f"{link.evidence.get_source_type_display()}（出处待补）",
                        }
                        for link in variant.evidence_links.all()
                    ],
                }
                for variant in entry.pronunciation_variants.all()
            ],
            "recordings": [
                {
                    "id": recording.id,
                    "district": recording.usage_dialect.name,
                }
                for recording in recordings_by_id.values()
            ],
        }
        for char in characters.intersection(spellings):
            by_character[char].append(item)
    return [
        {"character": char, "kind": character_kind(char), "entries": by_character[char]}
        for char in text
    ]
