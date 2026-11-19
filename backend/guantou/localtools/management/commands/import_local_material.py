import json
from pathlib import Path

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from guantou.legacy_import import resolve_dialect
from localtools.models import MaterialPack, MaterialRevision


class Command(BaseCommand):
    help = "将一份地方资料包 JSON 载入为待编辑、待发布的草稿。"

    def add_arguments(self, parser):
        parser.add_argument("source", type=Path)

    @transaction.atomic
    def handle(self, *args, source, **options):
        try:
            if source.stat().st_size > 192_000:
                raise ValueError("导入文件不得超过 192 KB")
            draft = json.loads(source.read_text(encoding="utf-8"))
            if not isinstance(draft, dict):
                raise ValueError("资料文件应为 JSON 对象")
            dialect = resolve_dialect(draft["dialect"])
            kind = draft["kind"]
            if dialect is None or kind not in MaterialPack.Kind.values:
                raise ValueError("未知方言限定码或工具")
            fields = (
                "version",
                "title",
                "accent",
                "source",
                "source_url",
                "rights",
                "payload",
            )
            pack, _ = MaterialPack.objects.get_or_create(dialect=dialect, kind=kind)
            data = {field: draft[field] for field in fields}
            existing = MaterialRevision.objects.filter(
                pack=pack, version=data["version"]
            ).first()
            if existing:
                if all(
                    getattr(existing, field) == value for field, value in data.items()
                ):
                    self.stdout.write(f"{existing} 已存在")
                    return
                raise ValueError("同一版本已存在，另取版本标识后重试")
            revision = MaterialRevision(pack=pack, **data)
            revision.full_clean()
            revision.save()
        except (OSError, ValueError, KeyError, TypeError, ValidationError) as error:
            raise CommandError(str(error)) from error
        self.stdout.write(self.style.SUCCESS(f"已导入草稿 {revision}"))
