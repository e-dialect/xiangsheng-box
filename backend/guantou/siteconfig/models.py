from django.db import models

from .capabilities import default_remote_capabilities, validate_remote_capabilities
from .profile_layout import default_enabled_tools, default_home_sections


class SiteSettings(models.Model):
    announcements = models.JSONField(default=list, blank=True, verbose_name="公告排序")
    featured_announcements = models.JSONField(
        default=list, blank=True, verbose_name="推荐公告"
    )
    # Kept only so historical deployments can be migrated without destroying data.
    # No public or admin surface reads or writes this retired legacy setting.
    featured_cans = models.JSONField(default=list, blank=True, verbose_name="推荐罐头")
    carousel = models.JSONField(default=list, blank=True, verbose_name="首页轮播")
    remote_capabilities = models.JSONField(
        default=default_remote_capabilities,
        blank=True,
        validators=[validate_remote_capabilities],
        verbose_name="远程能力开关",
        help_text="只能关闭客户端已编译的能力；不能凭空启用未编译能力。",
    )
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    @classmethod
    def get_solo(cls):
        item, _ = cls.objects.get_or_create(pk=1)
        return item

    def save(self, *args, **kwargs):
        self.pk = 1
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        return None

    def __str__(self):
        return "乡声集盒站点运营配置"

    class Meta:
        verbose_name = "站点运营配置"
        verbose_name_plural = "站点运营配置"


class ProductProfile(models.Model):
    """A registered product identity, independent of global site settings."""

    key = models.SlugField(max_length=40, primary_key=True, verbose_name="站点标识")
    editors = models.ManyToManyField(
        "auth.User",
        blank=True,
        related_name="editable_product_profiles",
        verbose_name="站点编辑",
    )
    active_revision = models.ForeignKey(
        "ProductProfileRevision",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        verbose_name="线上版本",
    )

    class Meta:
        verbose_name = "产品站点"
        verbose_name_plural = "产品站点"

    def __str__(self):
        return self.key


class ProductProfileRevision(models.Model):
    profile = models.ForeignKey(
        ProductProfile,
        related_name="revisions",
        on_delete=models.PROTECT,
        verbose_name="站点",
    )
    name = models.CharField(max_length=60, verbose_name="产品名称")
    credit = models.CharField(max_length=80, blank=True, verbose_name="署名")
    default_dialect = models.CharField(
        max_length=160, blank=True, verbose_name="默认查词方言限定码"
    )
    local_tools_dialect = models.CharField(
        max_length=160, blank=True, verbose_name="地方工具方言限定码"
    )
    home_sections = models.JSONField(
        default=default_home_sections, blank=True, verbose_name="首页栏目"
    )
    enabled_tools = models.JSONField(
        default=default_enabled_tools, blank=True, verbose_name="启用工具"
    )
    featured = models.JSONField(default=list, blank=True, verbose_name="精选")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    first_published_at = models.DateTimeField(
        null=True, blank=True, editable=False, verbose_name="首次发布时间"
    )

    class Meta:
        ordering = ["-id"]
        verbose_name = "站点版本"
        verbose_name_plural = "站点版本"

    def clean(self):
        super().clean()
        from .product_profiles import validate_profile_revision

        validate_profile_revision(self)

    def __str__(self):
        return f"{self.profile_id} / {self.pk or '草稿'}"
