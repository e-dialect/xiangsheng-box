from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.utils import timezone


class Notification(models.Model):
    class Verb(models.TextChoices):
        SYSTEM = "system.message", "系统消息"
        RECORDING_LIKE = "recording.like", "录音获赞"
        ENTRY_COMMENT = "entry.comment", "词条有新评论"
        # Legacy per-target reply verbs stay for historical rows; new replies use REPLY.
        ENTRY_REPLY = "entry.reply", "词条评论有新回复"
        ENTRY_COMMENT_LIKE = "entry.comment_like", "词条评论获赞"
        RECORDING_COMMENT = "recording.comment", "录音有新评论"
        RECORDING_REPLY = "recording.reply", "评论有新回复"
        REPLY = "comment.reply", "评论有新回复"
        RECORDING_COMMENT_LIKE = "recording.comment_like", "评论获赞"
        ENTRY_BOOKMARK = "entry.bookmark", "词条获收藏"
        USAGE_ATTESTATION = "entry.usage_attestation", "词条获地区补证"
        RECORDING_LINK = "recording.entry_link", "录音获词条关联"
        CURATION_REVIEW = "curation.review", "整理审核结果"

    LEVEL_SUCCESS = "success"
    LEVEL_INFO = "info"
    LEVEL_WARNING = "warning"
    LEVEL_ERROR = "error"
    LEVEL_CHOICES = (
        (LEVEL_SUCCESS, "Success"),
        (LEVEL_INFO, "Info"),
        (LEVEL_WARNING, "Warning"),
        (LEVEL_ERROR, "Error"),
    )

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="sent_notifications",
        null=True,
        blank=True,
        verbose_name="sender",
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_notifications",
        verbose_name="recipient",
    )
    target = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="replies",
        blank=True,
        null=True,
    )
    related_content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
    )
    related_object_id = models.CharField(max_length=255, blank=True, null=True)
    related_object = GenericForeignKey("related_content_type", "related_object_id")
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES, default=LEVEL_INFO)
    verb = models.CharField(
        max_length=64,
        choices=Verb.choices,
        default=Verb.SYSTEM,
    )
    description = models.TextField(blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    unread = models.BooleanField(default=True, db_index=True)
    public = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ("-timestamp",)
        indexes = [
            models.Index(fields=["recipient", "unread"]),
            models.Index(fields=["actor"]),
            models.Index(fields=["related_content_type", "related_object_id"]),
        ]
        verbose_name = "Notification"
        verbose_name_plural = "站内通知"

    @property
    def actor_object_id(self):
        return str(self.actor_id)

    def __str__(self):
        return self.verb

    @property
    def display_title(self):
        labels = dict(self.Verb.choices)
        legacy_labels = {
            "nameplate.support": "历史资料获支持",
            "can.like": "历史录音获收藏",
            "can.comment": "历史录音有新评论",
            "comment.like": "历史评论获支持",
            "can.review": "历史录音审核结果",
            "can.reuse": "历史录音被引用",
        }
        return labels.get(self.verb, legacy_labels.get(self.verb, self.verb))
