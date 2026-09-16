from datetime import timedelta

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


def curator_grant_default_expiry():
    """Default curator grants to one year instead of granting indefinitely."""

    return timezone.now() + timedelta(days=365)


class Dialect(models.Model):
    """按需展开的方言关系树节点，不等同于行政区划。"""

    name = models.CharField(max_length=120, verbose_name="名称")
    code = models.CharField(max_length=32, verbose_name="同级短码")
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        related_name="children",
        null=True,
        blank=True,
        verbose_name="父级方言点",
    )
    sort_order = models.IntegerField(default=0, verbose_name="同级排序")
    aliases = models.JSONField(default=list, blank=True, verbose_name="历史限定码")
    description = models.TextField(blank=True, verbose_name="描述")
    external_refs = models.JSONField(default=dict, blank=True, verbose_name="外部引用")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        return self.qualified_code

    @property
    def qualified_code(self):
        codes = []
        node = self
        visited = set()
        while node is not None and node.pk not in visited:
            if node.pk is not None:
                visited.add(node.pk)
            codes.append(node.code)
            node = node.parent
        return ".".join(reversed(codes))

    def clean(self):
        super().clean()
        if any(character in self.code for character in (".", "/")) or any(
            character.isspace() for character in self.code
        ):
            raise ValidationError({"code": "短码不得包含点、斜杠或空白"})
        if self.parent_id and self.pk:
            if self.parent_id == self.pk or self.parent_id in self.descendant_ids():
                raise ValidationError({"parent": "父节点不能是当前节点或其后代"})

    def descendant_ids(self, include_self=True):
        ids = [self.id] if include_self else []
        visited = set(ids)
        queue = list(self.children.all())
        while queue:
            node = queue.pop(0)
            if node.id in visited:
                continue
            visited.add(node.id)
            ids.append(node.id)
            queue.extend(list(node.children.all()))
        return ids

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["parent", "code"], name="unique_dialect_sibling_code"
            ),
            models.UniqueConstraint(
                fields=["code"],
                condition=models.Q(parent__isnull=True),
                name="unique_root_dialect_code",
            ),
        ]
        verbose_name = "方言点"
        verbose_name_plural = "方言点"


class Package(models.Model):
    """包装；文字检索入口，对应旧系统中的字头/写法。"""

    class PackageType(models.TextChoices):
        ORTHODOX = "orthodox", "正字"
        LOAN = "loan", "借字"
        POPULAR = "popular", "俗写"
        PHONETIC = "phonetic", "拟音"
        ROMANIZATION = "romanization", "罗马字"
        UNCERTAIN = "uncertain", "不确定"

    text = models.CharField(max_length=120, verbose_name="牌面文字")
    package_type = models.CharField(
        max_length=20,
        choices=PackageType.choices,
        default=PackageType.UNCERTAIN,
        verbose_name="包装类型",
    )
    unicode = models.CharField(max_length=80, blank=True, verbose_name="Unicode")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="扩展信息")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        return self.text

    class Meta:
        ordering = ["text", "package_type"]
        constraints = [
            models.UniqueConstraint(
                fields=["text", "package_type"], name="unique_package_text_type"
            )
        ]
        verbose_name = "包装"
        verbose_name_plural = "包装"


class Flavor(models.Model):
    """风味；语义核心，对应旧系统中拆分后的义项/概念。"""

    name = models.CharField(max_length=160, verbose_name="风味名")
    definition = models.TextField(verbose_name="释义")
    mandarin = models.JSONField(default=list, blank=True, verbose_name="普通话概念")
    tags = models.JSONField(default=list, blank=True, verbose_name="标签")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="扩展信息")
    geo_scope = models.CharField(max_length=160, blank=True, verbose_name="地理范围")
    concepticon_id = models.CharField(
        max_length=80, null=True, blank=True, verbose_name="Concepticon 编号"
    )
    packages = models.ManyToManyField(
        Package,
        related_name="flavors",
        through="FlavorPackage",
        blank=True,
        verbose_name="包装",
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_flavors",
        verbose_name="创建者",
    )
    visibility = models.BooleanField(default=True, verbose_name="是否可见")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["name", "id"]
        verbose_name = "风味"
        verbose_name_plural = "风味"


class LegacyImportRecord(models.Model):
    """Idempotency and provenance ledger for external legacy imports."""

    source_system = models.CharField(max_length=80)
    source_table = models.CharField(max_length=80)
    source_id = models.CharField(max_length=120)
    target_model = models.CharField(max_length=120)
    target_id = models.PositiveBigIntegerField()
    fingerprint = models.CharField(max_length=64, blank=True)
    action = models.CharField(max_length=32, default="created")
    metadata = models.JSONField(default=dict, blank=True)
    imported_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["source_system", "source_table", "source_id", "target_model"],
                name="unique_legacy_import_target",
            )
        ]
        indexes = [
            models.Index(
                fields=["target_model", "target_id"],
                name="legacy_target_idx",
            )
        ]
        ordering = ["source_system", "source_table", "source_id"]
        verbose_name = "旧数据导入记录"
        verbose_name_plural = "旧数据导入记录"


class LegacyReviewCandidate(models.Model):
    """A non-binding legacy-import suggestion waiting for human curation."""

    class CandidateType(models.TextChoices):
        SENSE_SEGMENTATION = "sense_segmentation", "建议分义"
        NUMBERING_ANOMALY = "numbering_anomaly", "编号异常"
        PRONUNCIATION_VARIATION = "pronunciation_variation", "读音差异复核"
        ENTRY_SPLIT = "entry_split", "建议拆词条"
        POSSIBLE_DUPLICATE = "possible_duplicate", "可能重复"

    class Status(models.TextChoices):
        PENDING = "pending", "待审核"
        ACCEPTED = "accepted", "已采纳"
        REJECTED = "rejected", "不采纳"

    source_system = models.CharField(max_length=80, verbose_name="来源系统")
    candidate_key = models.CharField(max_length=200, verbose_name="候选稳定键")
    candidate_type = models.CharField(
        max_length=32,
        choices=CandidateType.choices,
        verbose_name="候选类型",
    )
    primary_entry = models.ForeignKey(
        "Entry",
        on_delete=models.CASCADE,
        related_name="primary_legacy_review_candidates",
        null=True,
        blank=True,
        verbose_name="主要词条",
    )
    entries = models.ManyToManyField(
        "Entry",
        related_name="legacy_review_candidates",
        blank=True,
        verbose_name="相关词条",
    )
    source_ids = models.JSONField(default=list, blank=True, verbose_name="来源记录编号")
    payload = models.JSONField(default=dict, blank=True, verbose_name="候选原始材料")
    fingerprint = models.CharField(max_length=64, verbose_name="候选指纹")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name="审核状态",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        return f"{self.get_candidate_type_display()}：{self.candidate_key}"

    class Meta:
        ordering = ["candidate_type", "candidate_key", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["source_system", "candidate_type", "candidate_key"],
                name="unique_legacy_review_candidate",
            )
        ]
        indexes = [
            models.Index(
                fields=["candidate_type", "status"],
                name="legacy_candidate_status_idx",
            )
        ]
        verbose_name = "旧库审核候选"
        verbose_name_plural = "旧库审核候选"


class FlavorPackage(models.Model):
    class MappingType(models.TextChoices):
        PRIMARY = "primary", "主写法"
        SYNONYM = "synonym", "同义写法"
        BORROWED = "borrowed", "假借"
        DISPUTED = "disputed", "争议"

    flavor = models.ForeignKey(Flavor, on_delete=models.CASCADE, verbose_name="风味")
    package = models.ForeignKey(Package, on_delete=models.CASCADE, verbose_name="包装")
    mapping_type = models.CharField(
        max_length=20,
        choices=MappingType.choices,
        default=MappingType.PRIMARY,
        verbose_name="映射类型",
    )
    note = models.CharField(max_length=240, blank=True, verbose_name="说明")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["flavor", "package"], name="unique_flavor_package"
            )
        ]
        verbose_name = "风味包装关系"
        verbose_name_plural = "风味包装关系"


class Pronunciation(models.Model):
    """某写法表达某义项时，在某方言节点下的一种规范化读音。"""

    class Status(models.TextChoices):
        DRAFT = "draft", "草稿"
        VERIFIED = "verified", "已认证"
        REJECTED = "rejected", "已驳回"
        DISPUTED = "disputed", "争议"

    class ReadingType(models.TextChoices):
        GENERAL = "general", "通用"
        LITERARY = "literary", "文读"
        COLLOQUIAL = "colloquial", "白读"
        OTHER = "other", "其他"

    flavor = models.ForeignKey(
        Flavor,
        on_delete=models.PROTECT,
        related_name="pronunciations",
        verbose_name="义项",
    )
    package = models.ForeignKey(
        Package,
        on_delete=models.PROTECT,
        related_name="pronunciations",
        verbose_name="写法",
    )
    dialect = models.ForeignKey(
        Dialect,
        on_delete=models.PROTECT,
        related_name="pronunciations",
        verbose_name="方言点",
    )
    ipa = models.CharField(max_length=120, verbose_name="IPA")
    base_romanization = models.CharField(
        max_length=120, blank=True, verbose_name="变调前罗马字"
    )
    surface_romanization = models.CharField(
        max_length=120, blank=True, verbose_name="变调后罗马字"
    )
    reading_type = models.CharField(
        max_length=20,
        choices=ReadingType.choices,
        default=ReadingType.GENERAL,
        verbose_name="读音类型",
    )
    usage_note = models.TextField(blank=True, verbose_name="用法说明")
    sandhi_info = models.JSONField(default=dict, blank=True, verbose_name="变调信息")
    is_canonical = models.BooleanField(default=False, verbose_name="是否认证主变体")
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT, verbose_name="状态"
    )
    source_citation = models.CharField(
        max_length=300, blank=True, verbose_name="来源说明"
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_pronunciations",
        verbose_name="创建者",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        return (
            f"{self.package} / {self.flavor} / {self.dialect}: "
            f"{self.surface_romanization or self.base_romanization or self.ipa or '未标音'}"
        )

    def clean(self):
        super().clean()
        if self.package_id and self.flavor_id:
            linked = FlavorPackage.objects.filter(
                flavor_id=self.flavor_id, package_id=self.package_id
            ).exists()
            if not linked:
                raise ValidationError(
                    {"package": "该写法尚未与所选义项建立 FlavorPackage 关联"}
                )
        if self.sandhi_info and not (
            self.base_romanization and self.surface_romanization
        ):
            raise ValidationError(
                {"sandhi_info": "填写变调信息时必须同时提供变调前和变调后罗马字"}
            )

    class Meta:
        ordering = ["flavor_id", "dialect_id", "-is_canonical", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["package", "flavor", "dialect", "reading_type"],
                condition=models.Q(is_canonical=True),
                name="unique_canonical_pronunciation",
            )
        ]
        verbose_name = "读音"
        verbose_name_plural = "读音"


class Can(models.Model):
    """罐头；一段具体方言录音。"""

    class Status(models.TextChoices):
        UNLABELED = "unlabeled", "无标"
        PENDING = "pending", "待校验"
        TENTATIVE = "tentative", "社区暂定"
        VERIFIED = "verified", "正品认证"
        DISPUTED = "disputed", "争议"
        REJECTED = "rejected", "已驳回"

    audio_url = models.URLField(verbose_name="音频")
    recorder = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="cans",
        null=True,
        blank=True,
        verbose_name="录制者",
    )
    submitted_dialect = models.ForeignKey(
        Dialect,
        on_delete=models.SET_NULL,
        related_name="submitted_cans",
        null=True,
        blank=True,
        verbose_name="装罐时方言提示",
    )
    # 写法和释义以铭牌为权威；该字段只服务旧数据兼容与搜索兜底。
    concept_text = models.CharField(
        max_length=200, blank=True, verbose_name="普通话概念"
    )
    source_note = models.CharField(max_length=300, blank=True, verbose_name="来源说明")
    duration_ms = models.PositiveIntegerField(default=0, verbose_name="时长毫秒")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.UNLABELED,
        verbose_name="状态",
    )
    visibility = models.BooleanField(default=False, verbose_name="是否可见")
    verifier = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="verified_cans",
        null=True,
        blank=True,
        verbose_name="审核人",
    )
    transition_log = models.JSONField(
        default=list, blank=True, verbose_name="状态转换日志"
    )
    metadata = models.JSONField(default=dict, blank=True, verbose_name="扩展信息")
    views = models.PositiveIntegerField(default=0, verbose_name="访问量")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        label = (
            self.primary_nameplate.text_content
            if self.primary_nameplate
            else self.concept_text
        )
        return label or f"罐头 {self.id}"

    @property
    def primary_nameplate(self):
        prefetched = getattr(self, "_prefetched_objects_cache", {}).get("nameplates")
        if prefetched is not None:
            # 列表响应必须复用批量预取，不能为每个罐头再查询一次主铭牌。
            candidates = [
                plate
                for plate in prefetched
                if plate.is_primary
                and plate.status == Nameplate.Status.ACTIVE
                and plate.package_id
                and plate.flavor_id
                and plate.dialect_id
            ]
            return (
                sorted(candidates, key=lambda plate: (-plate.weight, plate.id))[0]
                if candidates
                else None
            )
        return (
            self.nameplates.filter(
                is_primary=True,
                status=Nameplate.Status.ACTIVE,
                package__isnull=False,
                flavor__isnull=False,
                dialect__isnull=False,
            )
            .order_by("-weight", "id")
            .first()
        )

    class Meta:
        ordering = ["-created_at", "-id"]
        verbose_name = "罐头"
        verbose_name_plural = "罐头"


class DailyCanSelection(models.Model):
    """Persisted per-day choice for the homepage "today can" source."""

    date = models.DateField(unique=True, verbose_name="日期")
    can = models.ForeignKey(
        Can,
        on_delete=models.CASCADE,
        related_name="daily_selections",
        verbose_name="当日罐头",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="选择时间")

    class Meta:
        ordering = ["-date"]
        verbose_name = "今日罐选择"
        verbose_name_plural = "今日罐选择"


class CanTransition(models.Model):
    """Append-only domain audit row for Can status transitions.

    Kept alongside Can.transition_log while the JSON field remains the v1 API
    compatibility source; migration to the relational table does not rewrite it.
    """

    can = models.ForeignKey(
        Can,
        on_delete=models.CASCADE,
        related_name="transitions",
        verbose_name="罐头",
    )
    from_status = models.CharField(
        max_length=20, choices=Can.Status.choices, verbose_name="转换前状态"
    )
    to_status = models.CharField(
        max_length=20, choices=Can.Status.choices, verbose_name="转换后状态"
    )
    action = models.CharField(max_length=20, verbose_name="操作")
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="can_transitions",
        verbose_name="操作者",
    )
    reason = models.CharField(max_length=300, blank=True, verbose_name="原因")
    created_at = models.DateTimeField(default=timezone.now, verbose_name="发生时间")

    def __str__(self):
        return f"{self.can_id} {self.from_status} -> {self.to_status}"

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(
                fields=["can", "created_at"], name="can_transition_can_at_idx"
            ),
            models.Index(
                fields=["actor", "created_at"], name="can_transition_actor_at_idx"
            ),
            models.Index(
                fields=["from_status", "to_status", "created_at"],
                name="can_transition_status_at_idx",
            ),
        ]
        verbose_name = "罐头状态转换"
        verbose_name_plural = "罐头状态转换"


class CanLike(models.Model):
    can = models.ForeignKey(
        Can,
        on_delete=models.CASCADE,
        related_name="likes",
        verbose_name="罐头",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="can_likes",
        verbose_name="用户",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["can", "user"], name="unique_can_like_user")
        ]
        verbose_name = "罐头点赞"
        verbose_name_plural = "罐头点赞"


class CanComment(models.Model):
    can = models.ForeignKey(
        Can,
        on_delete=models.CASCADE,
        related_name="comments",
        verbose_name="罐头",
    )
    nameplate = models.ForeignKey(
        "Nameplate",
        on_delete=models.CASCADE,
        related_name="comments",
        null=True,
        blank=True,
        verbose_name="铭牌",
    )
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="can_comments",
        verbose_name="作者",
    )
    content = models.CharField(max_length=500, verbose_name="内容")
    # 二重评论层级：parent 指向所属一级评论（顶层评论为 null），reply_to 指向
    # 被直接回复的具体评论（回复一级评论时为 null，回复某条回复时指向该回复）。
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        related_name="replies",
        null=True,
        blank=True,
        verbose_name="所属一级评论",
    )
    reply_to = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="+",
        null=True,
        blank=True,
        verbose_name="回复对象",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["nameplate", "created_at"]),
            models.Index(fields=["parent", "created_at"]),
        ]
        verbose_name = "罐头评论"
        verbose_name_plural = "罐头评论"


class CanCommentLike(models.Model):
    comment = models.ForeignKey(
        CanComment,
        on_delete=models.CASCADE,
        related_name="likes",
        verbose_name="评论",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="can_comment_likes",
        verbose_name="用户",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["comment", "user"],
                name="unique_can_comment_like_user",
            )
        ]
        verbose_name = "评论点赞"
        verbose_name_plural = "评论点赞"


class CanPost(models.Model):
    """建立在罐头之上的轻量表达；不允许脱离语音素材独立发布。"""

    class Visibility(models.TextChoices):
        PUBLIC = "public", "公开"
        PRIVATE = "private", "仅自己"

    can = models.ForeignKey(
        Can,
        on_delete=models.SET_NULL,
        related_name="posts",
        null=True,
        verbose_name="引用罐头",
    )
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="can_posts",
        verbose_name="作者",
    )
    text = models.CharField(max_length=500, blank=True, verbose_name="配文")
    visibility = models.CharField(
        max_length=16,
        choices=Visibility.choices,
        default=Visibility.PUBLIC,
        verbose_name="可见范围",
    )
    source_snapshot = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="罐头来源快照",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["can", "visibility", "created_at"]),
            models.Index(fields=["author", "created_at"]),
        ]
        verbose_name = "罐头表达"
        verbose_name_plural = "罐头表达"

    def __str__(self):
        return self.text or f"用同款 #{self.pk}"


class Nameplate(models.Model):
    """某个资料来源对一条录音提出的可查询、可追溯主张。"""

    class Status(models.TextChoices):
        ACTIVE = "active", "有效"
        WITHDRAWN = "withdrawn", "已撤回"
        SUPERSEDED = "superseded", "已修订"

    class SourceType(models.TextChoices):
        CREATOR = "creator", "创作者自述"
        ORAL = "oral", "口述"
        FIELDWORK = "fieldwork", "田野记录"
        BOOK = "book", "书籍"
        ARTICLE = "article", "论文/文章"
        ARCHIVE = "archive", "档案"
        WEB = "web", "网页"
        OTHER = "other", "其他"

    class EvidenceLevel(models.IntegerChoices):
        MEMORY = 1, "本人记忆"
        COMMUNITY = 2, "社区公认"
        DOCUMENT = 3, "文献考据"
        OFFICIAL = 4, "官方认证"

    can = models.ForeignKey(
        Can, on_delete=models.CASCADE, related_name="nameplates", verbose_name="罐头"
    )
    flavor = models.ForeignKey(
        Flavor,
        on_delete=models.SET_NULL,
        related_name="nameplates",
        null=True,
        blank=True,
        verbose_name="风味",
    )
    package = models.ForeignKey(
        Package,
        on_delete=models.SET_NULL,
        related_name="nameplates",
        null=True,
        blank=True,
        verbose_name="包装",
    )
    dialect = models.ForeignKey(
        Dialect,
        on_delete=models.SET_NULL,
        related_name="nameplates",
        null=True,
        blank=True,
        verbose_name="方言点主张",
    )
    pronunciation = models.ForeignKey(
        Pronunciation,
        on_delete=models.SET_NULL,
        related_name="attestations",
        null=True,
        blank=True,
        verbose_name="规范读音主张",
    )
    creator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="nameplates",
        null=True,
        blank=True,
        verbose_name="贴牌者",
    )
    text_content = models.CharField(
        max_length=160, blank=True, verbose_name="来源原样写法"
    )
    definition = models.TextField(blank=True, verbose_name="释义")
    pronunciation_text = models.CharField(
        max_length=160, blank=True, verbose_name="来源原样读音"
    )
    evidence_level = models.PositiveSmallIntegerField(
        choices=EvidenceLevel.choices,
        default=EvidenceLevel.MEMORY,
        verbose_name="证据等级",
    )
    source = models.JSONField(default=dict, verbose_name="结构化来源")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        verbose_name="状态",
    )
    supersedes = models.OneToOneField(
        "self",
        on_delete=models.SET_NULL,
        related_name="superseded_by",
        null=True,
        blank=True,
        verbose_name="修订自",
    )
    weight = models.IntegerField(default=0, verbose_name="权重")
    is_primary = models.BooleanField(default=False, verbose_name="是否主铭牌")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        return self.display_text

    @property
    def display_text(self):
        if self.text_content:
            return self.text_content
        if self.package_id:
            return self.package.text
        if self.pronunciation_text:
            return self.pronunciation_text
        if self.flavor_id:
            return self.flavor.name
        return f"铭牌 {self.pk}"

    @property
    def is_complete(self):
        return bool(self.package_id and self.flavor_id and self.dialect_id)

    def clean(self):
        super().clean()
        source_type = self.source.get("type") if isinstance(self.source, dict) else None
        if source_type not in self.SourceType.values:
            raise ValidationError({"source": "source.type 不是受支持的来源类型"})
        if self.pronunciation_id:
            conflicts = {}
            if self.package_id and self.package_id != self.pronunciation.package_id:
                conflicts["package"] = "与 pronunciation 的写法不一致"
            if self.flavor_id and self.flavor_id != self.pronunciation.flavor_id:
                conflicts["flavor"] = "与 pronunciation 的义项不一致"
            if self.dialect_id and self.dialect_id != self.pronunciation.dialect_id:
                conflicts["dialect"] = "与 pronunciation 的方言点不一致"
            if conflicts:
                raise ValidationError(conflicts)
        if self.supersedes_id and self.supersedes.can_id != self.can_id:
            raise ValidationError({"supersedes": "修订记录必须属于同一罐头"})

    def promote_to_primary(self):
        if self.status != self.Status.ACTIVE or not self.is_complete:
            return False
        Nameplate.objects.filter(can=self.can, is_primary=True).exclude(
            id=self.id
        ).update(is_primary=False)
        if not self.is_primary:
            self.is_primary = True
            self.save(update_fields=["is_primary", "updated_at"])
        return True

    class Meta:
        ordering = ["can_id", "-is_primary", "-weight", "id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(package__isnull=False)
                    | models.Q(flavor__isnull=False)
                    | models.Q(dialect__isnull=False)
                    | models.Q(pronunciation__isnull=False)
                    | ~models.Q(text_content="")
                    | ~models.Q(pronunciation_text="")
                ),
                name="nameplate_has_claim",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(is_primary=False)
                    | (
                        models.Q(status="active")
                        & models.Q(package__isnull=False)
                        & models.Q(flavor__isnull=False)
                        & models.Q(dialect__isnull=False)
                    )
                ),
                name="primary_nameplate_is_active_complete",
            ),
            models.UniqueConstraint(
                fields=["can"],
                condition=models.Q(is_primary=True),
                name="unique_primary_nameplate_per_can",
            ),
        ]
        verbose_name = "铭牌"
        verbose_name_plural = "铭牌"


class NameplateSupport(models.Model):
    """铭牌支持记录；同一用户对同一铭牌只能支持一次。"""

    nameplate = models.ForeignKey(
        Nameplate,
        on_delete=models.CASCADE,
        related_name="supports",
        verbose_name="铭牌",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="nameplate_supports",
        verbose_name="支持者",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    def __str__(self):
        return f"{self.user_id} 支持 {self.nameplate_id}"

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["nameplate", "user"], name="unique_nameplate_support_user"
            )
        ]
        verbose_name = "铭牌支持"
        verbose_name_plural = "铭牌支持"


class DialectCircle(models.Model):
    """围绕一个方言树节点组织的轻量社区入口。"""

    dialect = models.OneToOneField(
        Dialect,
        on_delete=models.PROTECT,
        related_name="circle",
        verbose_name="主方言",
    )
    name = models.CharField(max_length=120, verbose_name="圈子名称")
    description = models.TextField(blank=True, verbose_name="简介")
    members = models.ManyToManyField(
        User,
        through="CircleMembership",
        related_name="dialect_circles",
        blank=True,
    )
    is_active = models.BooleanField(default=True, verbose_name="是否开放")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["dialect__sort_order", "id"]
        verbose_name = "方言圈"
        verbose_name_plural = "方言圈"


class CircleMembership(models.Model):
    circle = models.ForeignKey(
        DialectCircle,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="circle_memberships",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["circle", "user"],
                name="unique_circle_membership",
            )
        ]


class RecordingChallenge(models.Model):
    """发现页上的录音挑战；不允许脱离罐头主线发布纯文本。"""

    title = models.CharField(max_length=120, verbose_name="标题")
    prompt = models.CharField(max_length=300, verbose_name="录音提示")
    flavor = models.ForeignKey(
        Flavor,
        on_delete=models.SET_NULL,
        related_name="recording_challenges",
        null=True,
        blank=True,
    )
    dialect = models.ForeignKey(
        Dialect,
        on_delete=models.SET_NULL,
        related_name="recording_challenges",
        null=True,
        blank=True,
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    class Meta:
        ordering = ["sort_order", "-created_at", "-id"]
        verbose_name = "录音挑战"
        verbose_name_plural = "录音挑战"


class Shelf(models.Model):
    """货架；主题组织容器，对应旧系统中的词单。"""

    class ShelfType(models.TextChoices):
        OFFICIAL = "official", "官方推荐"
        USER = "user", "用户自建"
        CAMPAIGN = "campaign", "征集活动"

    title = models.CharField(max_length=120, verbose_name="标题")
    slug = models.SlugField(max_length=120, unique=True, verbose_name="代码")
    description = models.TextField(blank=True, verbose_name="简介")
    shelf_type = models.CharField(
        max_length=20,
        choices=ShelfType.choices,
        default=ShelfType.USER,
        verbose_name="类型",
    )
    creator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shelves",
        verbose_name="创建者",
    )
    flavors = models.ManyToManyField(
        Flavor,
        through="ShelfFlavor",
        related_name="shelves",
        blank=True,
    )
    cans = models.ManyToManyField(
        Can,
        through="ShelfCan",
        related_name="shelves",
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        return self.title

    class Meta:
        ordering = ["title"]
        verbose_name = "货架"
        verbose_name_plural = "货架"


class ShelfFlavor(models.Model):
    shelf = models.ForeignKey(
        Shelf, on_delete=models.CASCADE, related_name="flavor_links"
    )
    flavor = models.ForeignKey(
        Flavor, on_delete=models.CASCADE, related_name="shelf_links"
    )
    sort_order = models.PositiveIntegerField(default=0)
    added_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="added_shelf_flavors",
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["shelf", "flavor"], name="unique_shelf_flavor"
            )
        ]


class ShelfCan(models.Model):
    shelf = models.ForeignKey(Shelf, on_delete=models.CASCADE, related_name="can_links")
    can = models.ForeignKey(Can, on_delete=models.CASCADE, related_name="shelf_links")
    sort_order = models.PositiveIntegerField(default=0)
    added_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="added_shelf_cans",
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["shelf", "can"], name="unique_shelf_can")
        ]


class SearchTerm(models.Model):
    """用于 Demo 热词排行的归一化搜索词。"""

    keyword = models.CharField(max_length=20, unique=True)
    count = models.PositiveBigIntegerField(default=0)
    last_searched_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.keyword

    class Meta:
        ordering = ["-count", "-last_searched_at", "id"]


class SearchTermHit(models.Model):
    """同一登录用户或匿名 visitor 每天只为一个搜索词计数一次。"""

    term = models.ForeignKey(
        SearchTerm,
        related_name="hits",
        on_delete=models.CASCADE,
    )
    attributer = models.CharField(max_length=80)
    hit_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.term.keyword}:{self.attributer}:{self.hit_date}"

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["term", "attributer", "hit_date"],
                name="unique_daily_search_term_hit",
            )
        ]


class Entry(models.Model):
    """A dialect lexeme with one coherent reading and core identity."""

    class Status(models.TextChoices):
        DRAFT = "draft", "初稿"
        REVIEWED = "reviewed", "已整理"
        DISPUTED = "disputed", "有分歧"
        REDIRECTED = "redirected", "已合并跳转"

    summary = models.TextField(blank=True, verbose_name="词条大意")
    identity_note = models.CharField(
        max_length=240,
        blank=True,
        verbose_name="读音或核心意义辨识说明",
    )
    usage_dialect = models.ForeignKey(
        Dialect,
        on_delete=models.PROTECT,
        related_name="entries",
        null=True,
        blank=True,
        verbose_name="已知使用范围",
    )
    writings = models.ManyToManyField(
        "WritingForm",
        through="EntryWriting",
        related_name="entries",
        blank=True,
        verbose_name="写法",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name="状态",
    )
    canonical_entry = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="redirected_entries",
        null=True,
        blank=True,
        verbose_name="合并后的规范词条",
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="created_entries",
        null=True,
        blank=True,
        verbose_name="创建者",
    )
    visibility = models.BooleanField(default=True, verbose_name="是否可见")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="扩展信息")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        if not self.pk:
            return self.summary or "未保存词条"
        primary = (
            self.entry_writings.filter(
                relation_type=EntryWriting.RelationType.PRIMARY,
                is_current=True,
            )
            .select_related("writing")
            .first()
        )
        return primary.writing.text if primary else (self.summary or f"词条 {self.pk}")

    def clean(self):
        super().clean()
        if self.canonical_entry_id and self.canonical_entry_id == self.pk:
            raise ValidationError({"canonical_entry": "词条不能跳转到自身"})
        if self.status == self.Status.REDIRECTED and not self.canonical_entry_id:
            raise ValidationError({"canonical_entry": "已合并词条必须指定规范词条"})
        if self.status != self.Status.REDIRECTED and self.canonical_entry_id:
            raise ValidationError({"status": "只有已合并词条可以指定规范词条"})

    class Meta:
        ordering = ["-updated_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(status="redirected", canonical_entry__isnull=False)
                    | (
                        ~models.Q(status="redirected")
                        & models.Q(canonical_entry__isnull=True)
                    )
                ),
                name="entry_redirect_has_canonical",
            )
        ]
        indexes = [
            models.Index(
                fields=["status", "visibility"], name="entry_status_visible_idx"
            ),
            models.Index(
                fields=["usage_dialect", "status"], name="entry_dialect_status_idx"
            ),
        ]
        verbose_name = "词条"
        verbose_name_plural = "词条"


class EntryBookmark(models.Model):
    """A private reading-list marker; it never affects curation rank or status."""

    entry = models.ForeignKey(
        Entry,
        on_delete=models.CASCADE,
        related_name="bookmarks",
        verbose_name="词条",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="entry_bookmarks",
        verbose_name="收藏者",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="收藏时间")

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["entry", "user"], name="unique_entry_bookmark"
            )
        ]
        verbose_name = "词条收藏"
        verbose_name_plural = "词条收藏"


class EntrySense(models.Model):
    """A numbered, related sense inside one Entry."""

    class Status(models.TextChoices):
        DRAFT = "draft", "初稿"
        REVIEWED = "reviewed", "已整理"
        DISPUTED = "disputed", "有分歧"

    entry = models.ForeignKey(
        Entry,
        on_delete=models.CASCADE,
        related_name="senses",
        verbose_name="词条",
    )
    sense_number = models.PositiveSmallIntegerField(default=1, verbose_name="义项编号")
    gloss = models.TextField(verbose_name="释义")
    usage_note = models.TextField(blank=True, verbose_name="用法说明")
    examples = models.JSONField(default=list, blank=True, verbose_name="例句")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name="状态",
    )
    concepts = models.ManyToManyField(
        "Concept",
        through="EntrySenseConcept",
        related_name="senses",
        blank=True,
        verbose_name="抽象概念",
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="created_entry_senses",
        null=True,
        blank=True,
        verbose_name="创建者",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        return f"{self.entry} {self.sense_number}. {self.gloss}"

    class Meta:
        ordering = ["entry_id", "sense_number", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["entry", "sense_number"], name="unique_entry_sense_number"
            )
        ]
        verbose_name = "词条义项"
        verbose_name_plural = "词条义项"


class WritingForm(models.Model):
    """A searchable written form; sharing it never merges Entries."""

    class FormType(models.TextChoices):
        ORTHOGRAPHIC = "orthographic", "汉字正字"
        POPULAR = "popular", "俗写"
        LOAN = "loan", "借字"
        PHONETIC = "phonetic", "拟音"
        ROMANIZATION = "romanization", "罗马字"
        UNCERTAIN = "uncertain", "待考写法"

    text = models.CharField(max_length=160, verbose_name="写法")
    normalized_text = models.CharField(
        max_length=160, blank=True, verbose_name="检索归一写法"
    )
    form_type = models.CharField(
        max_length=20,
        choices=FormType.choices,
        default=FormType.UNCERTAIN,
        verbose_name="写法类型",
    )
    language_tag = models.CharField(max_length=40, blank=True, verbose_name="语言标签")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="扩展信息")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        return self.text

    class Meta:
        ordering = ["text", "form_type", "id"]
        indexes = [
            models.Index(fields=["text", "form_type"], name="writing_text_type_idx"),
            models.Index(fields=["normalized_text"], name="writing_normalized_idx"),
        ]
        verbose_name = "词条写法"
        verbose_name_plural = "词条写法"


class EntryWriting(models.Model):
    class RelationType(models.TextChoices):
        PRIMARY = "primary", "主写法"
        ALTERNATE = "alternate", "其他写法"
        DISPUTED = "disputed", "争议写法"

    class Status(models.TextChoices):
        DRAFT = "draft", "初稿"
        REVIEWED = "reviewed", "已整理"
        DISPUTED = "disputed", "有分歧"
        REJECTED = "rejected", "不采用"

    entry = models.ForeignKey(
        Entry,
        on_delete=models.CASCADE,
        related_name="entry_writings",
        verbose_name="词条",
    )
    writing = models.ForeignKey(
        WritingForm,
        on_delete=models.PROTECT,
        related_name="entry_writings",
        verbose_name="写法",
    )
    relation_type = models.CharField(
        max_length=20,
        choices=RelationType.choices,
        default=RelationType.ALTERNATE,
        verbose_name="关系",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name="状态",
    )
    is_current = models.BooleanField(default=True, verbose_name="是否为当前关系")
    note = models.CharField(max_length=300, blank=True, verbose_name="说明")
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="created_entry_writings",
        null=True,
        blank=True,
        verbose_name="创建者",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        ordering = ["entry_id", "relation_type", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["entry", "writing", "relation_type"],
                condition=models.Q(is_current=True),
                name="unique_current_entry_writing",
            ),
            models.UniqueConstraint(
                fields=["entry"],
                condition=(
                    models.Q(is_current=True, relation_type="primary")
                    & ~models.Q(status="rejected")
                ),
                name="unique_current_primary_writing",
            ),
        ]
        verbose_name = "词条写法关系"
        verbose_name_plural = "词条写法关系"


class Concept(models.Model):
    """A cross-entry semantic node; it never acts as an Entry."""

    code = models.CharField(max_length=80, unique=True, verbose_name="概念代码")
    label = models.CharField(max_length=160, verbose_name="显示名称")
    definition = models.TextField(blank=True, verbose_name="定义")
    external_refs = models.JSONField(default=dict, blank=True, verbose_name="外部引用")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        return f"{self.code}: {self.label}"

    class Meta:
        ordering = ["code"]
        verbose_name = "抽象概念"
        verbose_name_plural = "抽象概念"


class EntrySenseConcept(models.Model):
    class RelationType(models.TextChoices):
        EXACT = "exact", "对应"
        BROADER = "broader", "较宽"
        NARROWER = "narrower", "较窄"
        RELATED = "related", "相关"

    sense = models.ForeignKey(
        EntrySense,
        on_delete=models.CASCADE,
        related_name="concept_links",
        verbose_name="词条义项",
    )
    concept = models.ForeignKey(
        Concept,
        on_delete=models.PROTECT,
        related_name="sense_links",
        verbose_name="抽象概念",
    )
    relation_type = models.CharField(
        max_length=20,
        choices=RelationType.choices,
        default=RelationType.EXACT,
        verbose_name="关系",
    )
    note = models.CharField(max_length=300, blank=True, verbose_name="说明")
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="created_sense_concepts",
        null=True,
        blank=True,
        verbose_name="创建者",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        ordering = ["sense_id", "concept_id", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["sense", "concept", "relation_type"],
                name="unique_sense_concept_relation",
            )
        ]
        verbose_name = "义项概念关系"
        verbose_name_plural = "义项概念关系"


class PronunciationVariant(models.Model):
    """A regional pronunciation of an Entry, independent from audio evidence."""

    class ReadingType(models.TextChoices):
        GENERAL = "general", "通用"
        LITERARY = "literary", "文读"
        COLLOQUIAL = "colloquial", "白读"
        OTHER = "other", "其他"

    class Status(models.TextChoices):
        DRAFT = "draft", "初稿"
        REVIEWED = "reviewed", "已整理"
        DISPUTED = "disputed", "有分歧"
        REJECTED = "rejected", "不采用"

    entry = models.ForeignKey(
        Entry,
        on_delete=models.CASCADE,
        related_name="pronunciation_variants",
        verbose_name="词条",
    )
    dialect = models.ForeignKey(
        Dialect,
        on_delete=models.PROTECT,
        related_name="entry_pronunciations",
        verbose_name="方言范围",
    )
    ipa = models.CharField(max_length=160, blank=True, verbose_name="IPA")
    base_romanization = models.CharField(
        max_length=160, blank=True, verbose_name="变调前罗马字"
    )
    surface_romanization = models.CharField(
        max_length=160, blank=True, verbose_name="变调后罗马字"
    )
    reading_type = models.CharField(
        max_length=20,
        choices=ReadingType.choices,
        default=ReadingType.GENERAL,
        verbose_name="读音类型",
    )
    usage_note = models.TextField(blank=True, verbose_name="用法说明")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name="状态",
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="created_pronunciation_variants",
        null=True,
        blank=True,
        verbose_name="创建者",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        value = self.surface_romanization or self.base_romanization or self.ipa
        return f"{self.entry} / {self.dialect}: {value}"

    def clean(self):
        super().clean()
        if not (self.ipa or self.base_romanization or self.surface_romanization):
            raise ValidationError("地区读音至少需要 IPA 或一种罗马字")

    class Meta:
        ordering = ["entry_id", "dialect_id", "reading_type", "id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    ~models.Q(ipa="")
                    | ~models.Q(base_romanization="")
                    | ~models.Q(surface_romanization="")
                ),
                name="pronunciation_variant_has_form",
            )
        ]
        indexes = [
            models.Index(fields=["dialect", "status"], name="pron_variant_dialect_idx"),
            models.Index(fields=["ipa"], name="pron_variant_ipa_idx"),
        ]
        verbose_name = "地区读音"
        verbose_name_plural = "地区读音"


class Recording(models.Model):
    """One audio object with a claimed usage range, never device location."""

    class RecordingType(models.TextChoices):
        WORD = "word", "词"
        PHRASE = "phrase", "短语"
        EXAMPLE = "example", "例句"
        OTHER = "other", "其他"

    class Status(models.TextChoices):
        DRAFT = "draft", "初稿"
        PUBLISHED = "published", "已公开"
        DISPUTED = "disputed", "有分歧"
        REJECTED = "rejected", "不采用"

    audio_url = models.URLField(verbose_name="音频")
    usage_dialect = models.ForeignKey(
        Dialect,
        on_delete=models.PROTECT,
        related_name="recordings",
        verbose_name="使用地区",
    )
    recorder = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="recordings",
        null=True,
        blank=True,
        verbose_name="录制者",
    )
    recording_type = models.CharField(
        max_length=20,
        choices=RecordingType.choices,
        default=RecordingType.WORD,
        verbose_name="录音类型",
    )
    original_gloss = models.TextField(blank=True, verbose_name="贡献者原始大意")
    duration_ms = models.PositiveIntegerField(default=0, verbose_name="时长毫秒")
    rights_statement = models.CharField(
        max_length=300, blank=True, verbose_name="录音授权说明"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name="状态",
    )
    visibility = models.BooleanField(default=False, verbose_name="是否可见")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="非定位扩展信息")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        return self.original_gloss or f"录音 {self.pk}"

    def clean(self):
        super().clean()
        if isinstance(self.metadata, dict):
            prohibited = {
                "location",
                "latitude",
                "longitude",
                "gps",
                "device_location",
                "legacy_location",
            }
            found = prohibited.intersection(key.lower() for key in self.metadata)
            if found:
                raise ValidationError({"metadata": "录音不得保存设备位置或坐标"})

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(
                fields=["usage_dialect", "status"], name="recording_dialect_status_idx"
            ),
            models.Index(
                fields=["visibility", "status"], name="recording_visible_status_idx"
            ),
        ]
        verbose_name = "录音"
        verbose_name_plural = "录音"


class RecordingEntryLink(models.Model):
    """A reviewable, versioned relation between one Recording and an Entry."""

    class Role(models.TextChoices):
        PRIMARY = "primary", "主要词条"
        MENTION = "mention", "句中词"
        COMPETING = "competing", "竞争解释"

    class Status(models.TextChoices):
        SUGGESTED = "suggested", "待确认"
        ACCEPTED = "accepted", "已接受"
        REJECTED = "rejected", "已拒绝"
        DISPUTED = "disputed", "有分歧"

    recording = models.ForeignKey(
        Recording,
        on_delete=models.CASCADE,
        related_name="entry_links",
        verbose_name="录音",
    )
    entry = models.ForeignKey(
        Entry,
        on_delete=models.PROTECT,
        related_name="recording_links",
        verbose_name="词条",
    )
    sense = models.ForeignKey(
        EntrySense,
        on_delete=models.SET_NULL,
        related_name="recording_links",
        null=True,
        blank=True,
        verbose_name="对应义项",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.PRIMARY,
        verbose_name="关系角色",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SUGGESTED,
        verbose_name="状态",
    )
    is_current = models.BooleanField(default=True, verbose_name="是否为当前关系")
    supersedes = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="successors",
        null=True,
        blank=True,
        verbose_name="修订自",
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="created_recording_entry_links",
        null=True,
        blank=True,
        verbose_name="提议者",
    )
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="reviewed_recording_entry_links",
        null=True,
        blank=True,
        verbose_name="确认者",
    )
    review_reason = models.CharField(
        max_length=300, blank=True, verbose_name="确认理由"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name="确认时间")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    def clean(self):
        super().clean()
        if self.sense_id and self.sense.entry_id != self.entry_id:
            raise ValidationError({"sense": "义项必须属于所关联的词条"})
        if self.supersedes_id and self.supersedes.recording_id != self.recording_id:
            raise ValidationError({"supersedes": "修订关系必须属于同一录音"})

    class Meta:
        ordering = ["recording_id", "role", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["recording", "entry", "role"],
                condition=models.Q(is_current=True),
                name="unique_current_recording_entry_role",
            ),
            models.UniqueConstraint(
                fields=["recording"],
                condition=models.Q(
                    is_current=True,
                    role="primary",
                    status="accepted",
                ),
                name="unique_accepted_primary_per_recording",
            ),
        ]
        indexes = [
            models.Index(
                fields=["entry", "role", "status"], name="recording_link_entry_idx"
            )
        ]
        verbose_name = "录音词条关系"
        verbose_name_plural = "录音词条关系"


class EvidenceRecord(models.Model):
    """Append-only snapshot of what a contributor or source actually said."""

    class SourceType(models.TextChoices):
        USER_STATEMENT = "user_statement", "用户原话"
        ORAL = "oral", "口述"
        FIELDWORK = "fieldwork", "田野记录"
        BOOK = "book", "书籍"
        ARTICLE = "article", "论文或文章"
        ARCHIVE = "archive", "档案"
        WEB = "web", "网页"
        LEGACY = "legacy", "旧库原文"
        OTHER = "other", "其他"

    source_type = models.CharField(
        max_length=24, choices=SourceType.choices, verbose_name="来源类型"
    )
    original_text = models.TextField(blank=True, verbose_name="来源原文")
    original_writing = models.CharField(
        max_length=160, blank=True, verbose_name="原样写法"
    )
    original_gloss = models.TextField(blank=True, verbose_name="原样释义")
    original_pronunciation = models.CharField(
        max_length=240, blank=True, verbose_name="原样读音"
    )
    citation = models.CharField(max_length=500, blank=True, verbose_name="出处")
    source_metadata = models.JSONField(
        default=dict, blank=True, verbose_name="来源快照"
    )
    contributor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="evidence_records",
        null=True,
        blank=True,
        verbose_name="贡献者",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="收录时间")

    def __str__(self):
        return (
            self.original_writing
            or self.original_gloss
            or self.citation
            or f"证据 {self.pk}"
        )

    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise ValidationError("证据记录不可原地覆写；请新增证据或修订记录")
        return super().save(*args, **kwargs)

    class Meta:
        ordering = ["-created_at", "-id"]
        verbose_name = "证据记录"
        verbose_name_plural = "证据记录"


class EvidenceLink(models.Model):
    """Attach one immutable evidence record to one or more domain claims."""

    class RelationType(models.TextChoices):
        SUBMITTED = "submitted", "原始提交"
        SUPPORTS = "supports", "支持"
        DISPUTES = "disputes", "质疑"

    evidence = models.ForeignKey(
        EvidenceRecord,
        on_delete=models.PROTECT,
        related_name="claim_links",
        verbose_name="证据",
    )
    entry = models.ForeignKey(
        Entry,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="evidence_links",
    )
    sense = models.ForeignKey(
        EntrySense,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="evidence_links",
    )
    pronunciation_variant = models.ForeignKey(
        PronunciationVariant,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="evidence_links",
    )
    recording = models.ForeignKey(
        Recording,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="evidence_links",
    )
    recording_entry_link = models.ForeignKey(
        RecordingEntryLink,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="evidence_links",
    )
    relation_type = models.CharField(
        max_length=20,
        choices=RelationType.choices,
        default=RelationType.SUBMITTED,
        verbose_name="证据关系",
    )
    note = models.CharField(max_length=300, blank=True, verbose_name="说明")
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="created_evidence_links",
        null=True,
        blank=True,
        verbose_name="关联者",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="关联时间")

    def clean(self):
        super().clean()
        targets = (
            self.entry_id,
            self.sense_id,
            self.pronunciation_variant_id,
            self.recording_id,
            self.recording_entry_link_id,
        )
        if sum(target is not None for target in targets) != 1:
            raise ValidationError("一条证据关联必须且只能指向一个领域对象")

    class Meta:
        ordering = ["evidence_id", "id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(
                        entry__isnull=False,
                        sense__isnull=True,
                        pronunciation_variant__isnull=True,
                        recording__isnull=True,
                        recording_entry_link__isnull=True,
                    )
                    | models.Q(
                        entry__isnull=True,
                        sense__isnull=False,
                        pronunciation_variant__isnull=True,
                        recording__isnull=True,
                        recording_entry_link__isnull=True,
                    )
                    | models.Q(
                        entry__isnull=True,
                        sense__isnull=True,
                        pronunciation_variant__isnull=False,
                        recording__isnull=True,
                        recording_entry_link__isnull=True,
                    )
                    | models.Q(
                        entry__isnull=True,
                        sense__isnull=True,
                        pronunciation_variant__isnull=True,
                        recording__isnull=False,
                        recording_entry_link__isnull=True,
                    )
                    | models.Q(
                        entry__isnull=True,
                        sense__isnull=True,
                        pronunciation_variant__isnull=True,
                        recording__isnull=True,
                        recording_entry_link__isnull=False,
                    )
                ),
                name="evidence_link_exactly_one_target",
            )
        ]
        indexes = [
            models.Index(
                fields=["evidence", "relation_type"], name="evidence_relation_idx"
            )
        ]
        verbose_name = "证据关联"
        verbose_name_plural = "证据关联"


class UsageAttestation(models.Model):
    """A person's claim that an Entry is used within a selected Dialect scope."""

    entry = models.ForeignKey(
        Entry,
        on_delete=models.CASCADE,
        related_name="usage_attestations",
        verbose_name="词条",
    )
    dialect = models.ForeignKey(
        Dialect,
        on_delete=models.PROTECT,
        related_name="usage_attestations",
        verbose_name="确认范围",
    )
    attester = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="usage_attestations",
        null=True,
        blank=True,
        verbose_name="确认者",
    )
    active = models.BooleanField(default=True, verbose_name="是否有效")
    note = models.CharField(max_length=300, blank=True, verbose_name="补充说明")
    attested_at = models.DateTimeField(auto_now_add=True, verbose_name="确认时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        ordering = ["-attested_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["attester", "entry", "dialect"],
                condition=models.Q(active=True, attester__isnull=False),
                name="unique_active_usage_attestation",
            )
        ]
        indexes = [
            models.Index(
                fields=["entry", "dialect", "active"], name="usage_entry_dialect_idx"
            )
        ]
        verbose_name = "本地使用确认"
        verbose_name_plural = "本地使用确认"


class CuratorGrant(models.Model):
    """Time-limited lexical or dialect-scoped curation authority."""

    class Role(models.TextChoices):
        LEXICAL = "lexical_curator", "词条整理员"
        REGIONAL = "regional_curator", "地区整理员"

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="curator_grants",
        verbose_name="整理员",
    )
    role = models.CharField(
        max_length=24, choices=Role.choices, verbose_name="权限类型"
    )
    dialect = models.ForeignKey(
        Dialect,
        on_delete=models.PROTECT,
        related_name="curator_grants",
        null=True,
        blank=True,
        verbose_name="授权地区范围",
    )
    valid_from = models.DateTimeField(default=timezone.now, verbose_name="生效时间")
    valid_until = models.DateTimeField(
        default=curator_grant_default_expiry, verbose_name="到期时间"
    )
    granted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="issued_curator_grants",
        null=True,
        blank=True,
        verbose_name="授权人",
    )
    reason = models.TextField(verbose_name="授权理由")
    revoked_at = models.DateTimeField(null=True, blank=True, verbose_name="撤销时间")
    revocation_reason = models.TextField(blank=True, verbose_name="撤销理由")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="记录时间")

    @property
    def is_active(self):
        now = timezone.now()
        return self.revoked_at is None and self.valid_from <= now < self.valid_until

    def clean(self):
        super().clean()
        if self.role == self.Role.REGIONAL and not self.dialect_id:
            raise ValidationError({"dialect": "地区整理员必须指定授权地区范围"})
        if self.role == self.Role.LEXICAL and self.dialect_id:
            raise ValidationError({"dialect": "词条整理员不使用地区范围"})
        if self.valid_until <= self.valid_from:
            raise ValidationError({"valid_until": "到期时间必须晚于生效时间"})
        if self.revoked_at and self.revoked_at < self.valid_from:
            raise ValidationError({"revoked_at": "撤销时间不能早于生效时间"})

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(role="lexical_curator", dialect__isnull=True)
                    | models.Q(role="regional_curator", dialect__isnull=False)
                ),
                name="curator_role_scope_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(valid_until__gt=models.F("valid_from")),
                name="curator_dates_valid",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(revoked_at__isnull=True)
                    | models.Q(revoked_at__gte=models.F("valid_from"))
                ),
                name="curator_revocation_valid",
            ),
        ]
        indexes = [
            models.Index(
                fields=["user", "role", "valid_until"], name="curator_user_role_idx"
            ),
            models.Index(
                fields=["dialect", "role", "valid_until"],
                name="curator_dialect_role_idx",
            ),
        ]
        verbose_name = "整理员授权"
        verbose_name_plural = "整理员授权"


class CuratorApplication(models.Model):
    """A contributor's reviewable request for a time-limited curator grant."""

    class Status(models.TextChoices):
        PENDING = "pending", "待审核"
        APPROVED = "approved", "已通过"
        REJECTED = "rejected", "未通过"
        WITHDRAWN = "withdrawn", "已撤回"

    applicant = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="curator_applications",
        verbose_name="申请人",
    )
    role = models.CharField(
        max_length=24, choices=CuratorGrant.Role.choices, verbose_name="申请类型"
    )
    dialect = models.ForeignKey(
        Dialect,
        on_delete=models.PROTECT,
        related_name="curator_applications",
        null=True,
        blank=True,
        verbose_name="申请地区范围",
    )
    statement = models.TextField(verbose_name="申请说明")
    experience = models.TextField(blank=True, verbose_name="相关经历")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name="状态",
    )
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="reviewed_curator_applications",
        null=True,
        blank=True,
        verbose_name="审核人",
    )
    review_reason = models.TextField(blank=True, verbose_name="审核理由")
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name="审核时间")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="申请时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def clean(self):
        super().clean()
        if self.role == CuratorGrant.Role.REGIONAL and not self.dialect_id:
            raise ValidationError({"dialect": "申请地区整理员必须选择授权范围"})
        if self.role == CuratorGrant.Role.LEXICAL and self.dialect_id:
            raise ValidationError({"dialect": "词条整理员申请不选择地区范围"})

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(role="lexical_curator", dialect__isnull=True)
                    | models.Q(role="regional_curator", dialect__isnull=False)
                ),
                name="curator_application_scope_valid",
            )
        ]
        indexes = [
            models.Index(
                fields=["applicant", "status", "created_at"],
                name="curator_applicant_status_idx",
            ),
            models.Index(
                fields=["role", "status", "created_at"],
                name="curator_role_status_idx",
            ),
        ]
        verbose_name = "整理员申请"
        verbose_name_plural = "整理员申请"


class CurationAction(models.Model):
    """Append-only audit record for every curator decision that changes meaning."""

    class ActionType(models.TextChoices):
        REVIEW = "review", "审核状态"
        SPLIT_ENTRY = "split_entry", "拆分词条"
        MERGE_ENTRIES = "merge_entries", "合并词条"
        NARROW_SCOPE = "narrow_scope", "缩小地区范围"
        LINK_CONCEPT = "link_concept", "关联概念"
        PRESERVE_COMPETING = "preserve_competing", "保留竞争解释"
        RESOLVE_LEGACY = "resolve_legacy", "处理旧库候选"

    class TargetType(models.TextChoices):
        ENTRY = "entry", "词条"
        SENSE = "sense", "义项"
        WRITING = "writing", "写法关系"
        PRONUNCIATION = "pronunciation", "地区读音"
        RECORDING = "recording", "录音"
        RECORDING_LINK = "recording_link", "录音词条关系"
        LEGACY_CANDIDATE = "legacy_candidate", "旧库候选"

    actor = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="curation_actions",
        verbose_name="整理人",
    )
    grant = models.ForeignKey(
        CuratorGrant,
        on_delete=models.SET_NULL,
        related_name="actions",
        null=True,
        blank=True,
        verbose_name="使用的授权",
    )
    action_type = models.CharField(
        max_length=24, choices=ActionType.choices, verbose_name="操作类型"
    )
    target_type = models.CharField(
        max_length=24, choices=TargetType.choices, verbose_name="对象类型"
    )
    target_id = models.PositiveBigIntegerField(verbose_name="对象编号")
    target_label = models.CharField(max_length=240, blank=True, verbose_name="对象摘要")
    before_snapshot = models.JSONField(default=dict, verbose_name="操作前快照")
    after_snapshot = models.JSONField(default=dict, verbose_name="操作后快照")
    reason = models.TextField(verbose_name="整理理由")
    evidence = models.ManyToManyField(
        EvidenceRecord,
        related_name="curation_actions",
        blank=True,
        verbose_name="依据",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="操作时间")

    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise ValidationError("整理记录不可覆写；需要更正时请新增一条记录")
        return super().save(*args, **kwargs)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(
                fields=["target_type", "target_id", "created_at"],
                name="curation_target_time_idx",
            ),
            models.Index(
                fields=["actor", "created_at"], name="curation_actor_time_idx"
            ),
        ]
        verbose_name = "整理操作记录"
        verbose_name_plural = "整理操作记录"


class Collection(models.Model):
    """A curated, entry-first box; independent of archived Shelf records."""

    owner = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="collections"
    )
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True, max_length=2000)
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class CollectionEntry(models.Model):
    collection = models.ForeignKey(
        Collection, on_delete=models.CASCADE, related_name="sections"
    )
    entry = models.ForeignKey(Entry, on_delete=models.PROTECT)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["collection", "entry"], name="collection_entry_unique"
            )
        ]


class CollectionRecording(models.Model):
    collection = models.ForeignKey(
        Collection, on_delete=models.CASCADE, related_name="recording_items"
    )
    section = models.ForeignKey(
        CollectionEntry,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="recording_items",
    )
    recording = models.ForeignKey(Recording, on_delete=models.PROTECT)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["section", "recording"],
                condition=models.Q(section__isnull=False),
                name="collection_section_recording_unique",
            ),
            models.UniqueConstraint(
                fields=["collection", "recording"],
                condition=models.Q(section__isnull=True),
                name="collection_pending_recording_unique",
            ),
        ]


class RecordingLike(models.Model):
    recording = models.ForeignKey(
        Recording, on_delete=models.CASCADE, related_name="likes"
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["recording", "user"], name="recording_like_unique"
            )
        ]


class RecordingComment(models.Model):
    # Keep the existing table and notification content type for V2 recording comments.
    recording = models.ForeignKey(
        Recording,
        on_delete=models.CASCADE,
        related_name="comments",
        null=True,
        blank=True,
    )
    entry = models.ForeignKey(
        Entry, on_delete=models.CASCADE, related_name="comments", null=True, blank=True
    )
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="replies"
    )
    reply_to = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="reply_targets",
    )
    body = models.TextField(max_length=2000)
    hidden = models.BooleanField(default=False)
    client_id = models.UUIDField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["author", "client_id"], name="recording_comment_request_unique"
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(recording__isnull=False, entry__isnull=True)
                    | models.Q(recording__isnull=True, entry__isnull=False)
                ),
                name="discussion_exactly_one_target",
            ),
        ]


class RecordingCommentLike(models.Model):
    comment = models.ForeignKey(
        RecordingComment, on_delete=models.CASCADE, related_name="likes"
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["comment", "user"], name="recording_comment_like_unique"
            )
        ]


class DailyRecordingSelection(models.Model):
    date = models.DateField(unique=True)
    recording = models.ForeignKey(Recording, on_delete=models.SET_NULL, null=True)
