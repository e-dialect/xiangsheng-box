from django.views.decorators.cache import never_cache
from django.utils.decorators import method_decorator
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from guantou.legacy_import import resolve_dialect

from .models import MaterialPack, MaterialRevision
from .public import public_material


def parent_pinyin_for(dialect):
    # A guide may name specific dialect points served by the same revision.
    ancestors = []
    node = dialect.parent
    while node and node.pk not in ancestors:
        ancestors.append(node.pk)
        node = node.parent
    published = {
        pack.dialect_id: pack.active_revision
        for pack in MaterialPack.objects.filter(
            dialect_id__in=ancestors,
            kind=MaterialPack.Kind.PINYIN,
            active_revision__available=True,
            active_revision__published_at__isnull=False,
        ).select_related("active_revision")
    }
    code = dialect.qualified_code
    for pk in ancestors:
        revision = published.get(pk)
        if revision and code in revision.payload.get("also_for", []):
            return revision
    return None


@method_decorator(never_cache, name="dispatch")
class LocalToolPacks(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        code = request.query_params.get("dialect", "").strip()
        quiz_version = request.query_params.get("quiz_version", "").strip()
        if not code or len(code) > 512 or len(quiz_version) > 40:
            return Response({"detail": "请提供有效的方言限定码与资料版本"}, status=400)
        dialect = resolve_dialect(code)
        if dialect is None:
            return Response(
                {"dialect": None, "packs": {}, "quiz_unavailable": bool(quiz_version)}
            )

        packs = {}
        for pack in MaterialPack.objects.filter(
            dialect=dialect,
            active_revision__available=True,
            active_revision__published_at__isnull=False,
        ).select_related("active_revision"):
            revision = pack.active_revision
            if (
                pack.kind == MaterialPack.Kind.QUIZ
                and quiz_version != revision.version
                and quiz_version
            ):
                revision = MaterialRevision.objects.filter(
                    pack=pack,
                    version=quiz_version,
                    available=True,
                    published_at__isnull=False,
                ).first()
            if revision:
                packs[pack.kind] = public_material(revision)
        if MaterialPack.Kind.PINYIN not in packs:
            guide = parent_pinyin_for(dialect)
            if guide:
                packs[MaterialPack.Kind.PINYIN] = public_material(guide)
        return Response(
            {
                "dialect": {
                    "id": dialect.pk,
                    "qualified_code": dialect.qualified_code,
                    "name": dialect.name,
                },
                "packs": packs,
                "quiz_unavailable": bool(
                    quiz_version and MaterialPack.Kind.QUIZ not in packs
                ),
            }
        )
