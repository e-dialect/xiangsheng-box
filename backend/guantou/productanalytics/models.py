from django.db import models


class ProductEventName(models.TextChoices):
    LISTEN_FEED_VIEW = "listen_feed_view", "浏览听音流"
    ENTRY_SEARCH = "entry_search", "搜索词条"
    RECORDING_SUBMIT = "recording_submit", "提交录音"
    EVIDENCE_SUBMIT = "evidence_submit", "提交补证"
    CURATION_TASK_COMPLETE = "curation_task_complete", "完成整理任务"
    SHARE_CLIPBOARD = "share_clipboard", "复制分享链接"
    SHARE_SYSTEM = "share_system", "系统分享"
    SHARE_OPENED = "share_opened", "冷启动打开分享"
    CAPABILITY_DEGRADED = "capability_degraded", "能力降级"


class ProductPlatform(models.TextChoices):
    H5 = "h5", "H5"
    WECHAT = "mp-weixin", "微信小程序"
    APP = "app", "原生应用"
    UNKNOWN = "unknown", "未知"


class ProductEvent(models.Model):
    """Privacy-minimized raw event; automatically removed within 90 days."""

    event_name = models.CharField(max_length=48, choices=ProductEventName.choices)
    session_hash = models.CharField(max_length=64)
    platform = models.CharField(
        max_length=16,
        choices=ProductPlatform.choices,
        default=ProductPlatform.UNKNOWN,
    )
    site = models.CharField(max_length=40, blank=True)
    surface = models.CharField(max_length=32, blank=True)
    result = models.CharField(max_length=24, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-received_at", "-id"]
        indexes = [
            models.Index(fields=["received_at"]),
            models.Index(fields=["event_name", "platform", "received_at"]),
        ]
        verbose_name = "产品事件原始明细"
        verbose_name_plural = "产品事件原始明细"


class ProductEventDailySummary(models.Model):
    date = models.DateField()
    event_name = models.CharField(max_length=48, choices=ProductEventName.choices)
    platform = models.CharField(max_length=16, choices=ProductPlatform.choices)
    site = models.CharField(max_length=40, blank=True)
    surface = models.CharField(max_length=32, blank=True)
    result = models.CharField(max_length=24, blank=True)
    event_count = models.PositiveIntegerField(default=0)
    unique_sessions = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "event_name", "platform", "site", "surface", "result"]
        constraints = [
            models.UniqueConstraint(
                fields=["date", "event_name", "platform", "site", "surface", "result"],
                name="unique_product_event_daily_dimension",
            )
        ]
        indexes = [models.Index(fields=["date", "event_name", "platform"])]
        verbose_name = "产品事件日汇总"
        verbose_name_plural = "产品事件日汇总"
