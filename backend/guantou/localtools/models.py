from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone

from .content import VALIDATORS, validate_content


class RegionalMaintainer(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        limit_choices_to={"is_staff": True},
        verbose_name="后台账号",
    )
    dialect = models.ForeignKey(
        "guantou.Dialect",
        on_delete=models.PROTECT,
        verbose_name="维护方言点",
        help_text="可维护此方言点现有和未来的所有地方资料包。下级方言点需单独分配。",
    )

    class Meta:
        verbose_name = "地方管理员"
        verbose_name_plural = "地方管理员"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "dialect"], name="localtools_unique_maintainer_region"
            )
        ]

    def __str__(self):
        return f"{self.user} · {self.dialect.qualified_code}"


class MaterialPack(models.Model):
    class Kind(models.TextChoices):
        PINYIN = "pinyin", "拼音方案"
        QUIZ = "quiz", "聪明花开"
        KINSHIP = "kinship", "亲戚计算器"

    dialect = models.ForeignKey(
        "guantou.Dialect", on_delete=models.PROTECT, verbose_name="方言"
    )
    kind = models.CharField("工具", choices=Kind.choices, max_length=10)
    active_revision = models.ForeignKey(
        "MaterialRevision",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )

    class Meta:
        verbose_name = "地方资料包"
        verbose_name_plural = "地方资料包"
        constraints = [
            models.UniqueConstraint(
                fields=["dialect", "kind"], name="localtools_one_pack_per_kind"
            )
        ]

    def __str__(self):
        return f"{self.dialect} · {self.get_kind_display()}"


class MaterialRevision(models.Model):
    pack = models.ForeignKey(
        MaterialPack, on_delete=models.PROTECT, verbose_name="资料包"
    )
    version = models.SlugField("版本标识", max_length=40)
    title = models.CharField("展示标题", max_length=120)
    accent = models.CharField("适用口音", max_length=200)
    source = models.CharField("公开来源", max_length=300)
    source_url = models.URLField("公开出处网址", blank=True, max_length=512)
    rights = models.TextField("发布权利与校订依据（仅后台可见）")
    payload = models.JSONField("资料内容")
    published_at = models.DateTimeField(
        "首次发布", null=True, blank=True, editable=False
    )
    available = models.BooleanField("可按版本访问", default=False, editable=False)

    class Meta:
        verbose_name = "地方资料版本"
        verbose_name_plural = "地方资料版本"
        constraints = [
            models.UniqueConstraint(
                fields=["pack", "version"], name="localtools_unique_revision"
            )
        ]
        permissions = [("publish_materialrevision", "可以发布、恢复或下架地方资料")]

    def __str__(self):
        return f"{self.pack} · {self.version}"

    def clean(self):
        super().clean()
        if self.pack_id and self.pack.kind in VALIDATORS:
            try:
                validate_content(self.pack.kind, self.payload)
            except ValidationError as error:
                raise ValidationError({"payload": error.messages}) from error
        for field in ("title", "accent", "source", "rights"):
            if not getattr(self, field).strip():
                raise ValidationError({field: "请输入有效内容"})

    def save(self, *args, **kwargs):
        if self.pk:
            # An editor may have opened the draft before the publisher approved it.
            # Update editable fields only and never overwrite the published snapshot.
            fields = ("title", "accent", "source", "source_url", "rights", "payload")
            if (
                not type(self)
                .objects.filter(pk=self.pk, published_at__isnull=True)
                .update(**{field: getattr(self, field) for field in fields})
            ):
                raise ValidationError("此版本已经发布。请新建修订版本。")
            return
        super().save(*args, **kwargs)

    @transaction.atomic
    def publish(self):
        pack = MaterialPack.objects.select_for_update().get(pk=self.pack_id)
        revision = type(self).objects.select_for_update().get(pk=self.pk)
        revision.full_clean()
        type(self).objects.filter(pk=revision.pk).update(
            published_at=revision.published_at or timezone.now(), available=True
        )
        pack.active_revision = revision
        pack.save(update_fields=["active_revision"])

    @transaction.atomic
    def withdraw(self):
        pack = MaterialPack.objects.select_for_update().get(pk=self.pack_id)
        type(self).objects.filter(pk=self.pk, published_at__isnull=False).update(
            available=False
        )
        if pack.active_revision_id == self.pk:
            pack.active_revision = None
            pack.save(update_fields=["active_revision"])
