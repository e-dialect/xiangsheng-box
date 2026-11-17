"""Version-one content contract shared by admin edits, import and publication."""

import json

from django.core.exceptions import ValidationError

RELATIONS = {"fa", "mu", "xiong", "di", "jie", "mei", "fu", "qi", "zi", "nv"}


def check(condition, label):
    if not condition:
        raise ValidationError(label)


def mapping(value, label):
    check(isinstance(value, dict), f"{label}应为对象")
    return value


def items(value, label, maximum, *, minimum=1):
    check(
        isinstance(value, list) and minimum <= len(value) <= maximum,
        f"{label}需有 {minimum} 至 {maximum} 项",
    )
    return [mapping(item, label) for item in value]


def string(value, label, maximum=400, *, optional=False):
    check(
        isinstance(value, str)
        and len(value) <= maximum
        and (optional or value.strip()),
        f"{label}应为有效文字（最多 {maximum} 字）",
    )


def public_references(item):
    for key, label in (("entry_id", "词条编号"), ("recording_id", "录音编号")):
        value = item.get(key)
        check(
            value is None or type(value) is int and 1 <= value <= 2**53 - 1,
            f"{label}须为正整数",
        )


def validate_pinyin(payload):
    for section in items(payload.get("sections"), "拼音章节", 20):
        string(section.get("title"), "章节标题", 120)
        for row in items(section.get("rows", []), "拼音表", 120, minimum=0):
            string(row.get("form"), "拼写", 80)
            string(row.get("ipa", ""), "音标或调值", 80, optional=True)
            string(row.get("example", ""), "例字", 120, optional=True)
            public_references(row)
        text = section.get("text", "")
        string(text, "章节说明", 10000, optional=True)
        check(text.strip() or section.get("rows"), "拼音章节需有说明或拼音表")


def validate_quiz(payload):
    for idx, question in enumerate(items(payload.get("questions"), "题目", 40), 1):
        label = f"第 {idx} 题"
        string(question.get("prompt"), f"{label}题干", 2000)
        options = question.get("options")
        check(
            isinstance(options, list) and 2 <= len(options) <= 8,
            f"{label}需有 2 至 8 个选项",
        )
        for option in options:
            string(option, f"{label}选项", 240)
        check(
            len({option.strip() for option in options}) == len(options),
            f"{label}有重复选项",
        )
        answer = question.get("answer")
        check(
            type(answer) is int and 0 <= answer < len(options),
            f"{label}答案编号无效（从 0 开始）",
        )
        string(question.get("explanation"), f"{label}解析", 2000)


def validate_kinship(payload):
    string(payload.get("selfId"), "起始角色", 100)
    nodes = items(payload.get("nodes"), "角色", 150)
    node_ids = set()
    for node in nodes:
        node_id = node.get("id")
        string(node_id, "角色编号", 100)
        check(node_id not in node_ids, f"重复角色 {node_id}")
        node_ids.add(node_id)
        string(node.get("label"), f"{node_id} 的角色名称", 120)
        check(
            node.get("sex", "unknown") in ("male", "female", "unknown"),
            f"{node_id} 的性别无效",
        )
        check(
            node.get("kind", "person") in ("person", "group"),
            f"{node_id} 的角色类型无效",
        )
        for term in items(node.get("terms", []), "地方称谓", 12, minimum=0):
            string(term.get("text"), "称谓", 120)
            string(term.get("usage", ""), "称谓用法", optional=True)
            public_references(term)
    check(payload["selfId"] in node_ids, "找不到起始角色")
    for node in nodes:
        relations = mapping(node.get("relations", {}), "角色关系")
        check(set(relations) <= RELATIONS, "不支持的关系键")
        for target in relations.values():
            targets = (
                target
                if isinstance(target, list)
                else [target] if target is not None else []
            )
            check(len(targets) <= 12, "同一关系最多指向 12 个角色")
            check(
                all(isinstance(value, str) and value in node_ids for value in targets),
                "找不到关系指向的角色",
            )


VALIDATORS = {
    "pinyin": validate_pinyin,
    "quiz": validate_quiz,
    "kinship": validate_kinship,
}


def validate_content(kind, payload):
    payload = mapping(payload, "资料内容")
    check(
        type(payload.get("schema")) is int and payload["schema"] == 1,
        "资料格式版本应为 1",
    )
    check(
        len(json.dumps(payload, ensure_ascii=False).encode("utf-8")) <= 180_000,
        "资料不得超过 180 KB",
    )
    VALIDATORS[kind](payload)
