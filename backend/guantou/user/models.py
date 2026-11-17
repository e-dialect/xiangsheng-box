from django.contrib.auth.models import User
from django.db import models


class UserInfo(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="user_info",
        verbose_name="用户",
        primary_key=True,
    )
    wechat = models.CharField(
        max_length=128, blank=True, verbose_name="微信标识码"
    )  # openid
    qq = models.CharField(max_length=128, blank=True, verbose_name="qq标识码")  # openid
    nickname = models.CharField(blank=True, max_length=100, verbose_name="昵称")
    birthday = models.DateField(
        blank=True, null=True, default=None, verbose_name="生日"
    )
    telephone = models.CharField(blank=True, max_length=50, verbose_name="电话")
    avatar = models.URLField(
        default="",
        blank=True,
        verbose_name="头像",
    )
    primary_dialect = models.ForeignKey(
        "guantou.Dialect",
        on_delete=models.SET_NULL,
        related_name="primary_users",
        null=True,
        blank=True,
        verbose_name="主要方言点",
    )
    followed_dialects = models.ManyToManyField(
        "guantou.Dialect",
        related_name="subscribers",
        blank=True,
        verbose_name="关注的方言点",
    )
    legacy_location = models.JSONField(
        default=dict,
        blank=True,
        editable=False,
        verbose_name="迁移前行政地点",
    )
    points_sum = models.IntegerField(default=0, verbose_name="总积分")
    points_now = models.IntegerField(default=0, verbose_name="当前积分")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        return self.user.username

    def ID(self):
        return self.user.id

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["wechat"],
                condition=~models.Q(wechat=""),
                name="unique_nonempty_user_wechat",
            ),
            models.UniqueConstraint(
                fields=["qq"],
                condition=~models.Q(qq=""),
                name="unique_nonempty_user_qq",
            ),
            models.UniqueConstraint(
                fields=["telephone"],
                condition=~models.Q(telephone=""),
                name="unique_nonempty_user_telephone",
            ),
        ]
        verbose_name_plural = "用户详细信息"
        verbose_name = "用户详细信息"


class UserFollow(models.Model):
    follower = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="following_relationships",
        verbose_name="关注者",
    )
    followed = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="follower_relationships",
        verbose_name="被关注者",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["follower", "followed"], name="unique_user_follow"
            ),
            models.CheckConstraint(
                condition=~models.Q(follower=models.F("followed")),
                name="prevent_self_follow",
            ),
        ]
        verbose_name = "用户关注"
        verbose_name_plural = "用户关注"


class EmailVerification(models.Model):
    class Purpose(models.TextChoices):
        REGISTER = "register", "注册"
        BIND = "bind", "绑定邮箱"
        RESET_PASSWORD = "reset_password", "重置密码"

    normalized_email = models.EmailField(max_length=254)
    purpose = models.CharField(max_length=32, choices=Purpose.choices)
    subject = models.CharField(max_length=150, blank=True, default="")
    code_digest = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    delivered_at = models.DateTimeField(null=True, blank=True)
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["normalized_email", "purpose", "subject"],
                name="unique_email_verification_scope",
            )
        ]
        indexes = [models.Index(fields=["expires_at"], name="email_code_expires_idx")]
        verbose_name = "邮箱验证码"
        verbose_name_plural = "邮箱验证码"


class WechatLoginRequest(models.Model):
    class Channel(models.TextChoices):
        WEB = "web"
        WEB_QR = "web_qr"
        APP = "app"

    class Status(models.TextChoices):
        PENDING = "pending"
        CONFIRMED = "confirmed"
        REDEEMED = "redeemed"
        CANCELLED = "cancelled"

    id = models.CharField(primary_key=True, max_length=32)
    channel = models.CharField(max_length=6, choices=Channel.choices)
    exchange_digest = models.CharField(max_length=64)
    expires_at = models.DateTimeField(db_index=True)
    status = models.CharField(
        max_length=9, choices=Status.choices, default=Status.PENDING
    )
    user = models.ForeignKey(User, null=True, on_delete=models.CASCADE)
    openid_digest = models.CharField(max_length=64, blank=True)
    is_new = models.BooleanField(default=False)
