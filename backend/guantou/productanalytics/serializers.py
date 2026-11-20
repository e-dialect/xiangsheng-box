import re

from rest_framework import serializers

from .models import ProductEventName, ProductPlatform

SURFACES = {"listen", "search", "record", "entry_detail", "curation"}
SHARE_SURFACES = {"collection", "entry", "recording", "search", "quiz"}
SHARE_RESULTS = {
    ProductEventName.SHARE_CLIPBOARD: {"success", "error"},
    ProductEventName.SHARE_SYSTEM: {"attempt", "success", "error", "cancelled"},
    ProductEventName.SHARE_OPENED: {"success"},
}
RESULTS = {"view", "success", "empty", "error", "unavailable", "cancelled"}
METADATA_RULES = {
    "tab": {"today", "dialect", "following", "recommended"},
    "result_bucket": {"0", "1-5", "6-20", "21+"},
    "filter_count": range(0, 11),
    "has_linked_entry": {True, False},
    "dialect_depth": range(0, 11),
    "task_kind": {
        "legacy_candidate",
        "entry",
        "sense",
        "recording",
        "pronunciation",
        "recording_link",
    },
    "capability": {
        "listen_feed",
        "entry_search",
        "recording",
        "usage_attestation",
        "curation_workbench",
        "wechat_auth",
    },
    "reason": {"not_compiled", "disabled_remotely", "config_unavailable"},
}


class ProductEventInputSerializer(serializers.Serializer):
    session_id = serializers.CharField(write_only=True, min_length=8, max_length=128)
    event_name = serializers.ChoiceField(choices=ProductEventName.choices)
    platform = serializers.ChoiceField(choices=ProductPlatform.choices)
    surface = serializers.ChoiceField(
        required=False, allow_blank=True, choices=sorted(SURFACES | SHARE_SURFACES)
    )
    result = serializers.ChoiceField(
        required=False, allow_blank=True, choices=sorted(RESULTS | {"attempt"})
    )
    metadata = serializers.JSONField(required=False, default=dict)

    def to_internal_value(self, data):
        attrs = super().to_internal_value(data)
        if attrs["event_name"] in SHARE_RESULTS and set(data) - set(self.fields):
            raise serializers.ValidationError("分享计数不接受附加字段")
        return attrs

    def validate(self, attrs):
        event = attrs["event_name"]
        surface = attrs.get("surface", "")
        result = attrs.get("result", "")
        if event in SHARE_RESULTS:
            if not re.fullmatch(r"session-[a-z0-9]+-[a-z0-9]{8,}", attrs["session_id"]):
                raise serializers.ValidationError(
                    {"session_id": "需要临时页面会话标识"}
                )
            if attrs["platform"] != ProductPlatform.H5:
                raise serializers.ValidationError({"platform": "仅支持 H5 分享事件"})
            if surface not in SHARE_SURFACES:
                raise serializers.ValidationError({"surface": "无效的分享对象类型"})
            if result not in SHARE_RESULTS[event]:
                raise serializers.ValidationError({"result": "无效的分享结果"})
            if attrs["metadata"]:
                raise serializers.ValidationError(
                    {"metadata": "分享计数不接受附加资料"}
                )
        elif (surface and surface not in SURFACES) or (
            result and result not in RESULTS
        ):
            raise serializers.ValidationError("该事件不支持此来源或结果")
        return attrs

    def validate_metadata(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("metadata 必须是对象")
        unknown = sorted(set(value) - set(METADATA_RULES))
        if unknown:
            raise serializers.ValidationError(
                f"不允许记录这些字段：{', '.join(unknown)}"
            )
        normalized = {}
        for key, candidate in value.items():
            allowed = METADATA_RULES[key]
            if key in {"filter_count", "dialect_depth"}:
                if type(candidate) is not int or candidate not in allowed:
                    raise serializers.ValidationError(f"{key} 超出允许范围")
            elif not isinstance(candidate, (str, bool)) or candidate not in allowed:
                raise serializers.ValidationError(f"{key} 取值无效")
            normalized[key] = candidate
        return normalized
