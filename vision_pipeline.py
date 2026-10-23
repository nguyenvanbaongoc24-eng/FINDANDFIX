"""Evidence-first image recognition for the Parts Scanner APIs."""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import os
import re
import uuid
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 3 * 1024 * 1024
DATA_URL_PATTERN = re.compile(r"^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$", re.I)


@dataclass
class VisionPipelineError(Exception):
    code: str
    message: str
    status_code: int = 400


def _magic_mime(raw: bytes) -> str | None:
    if raw.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if raw.startswith(b"RIFF") and raw[8:12] == b"WEBP":
        return "image/webp"
    return None


def validate_image_data_url(value: Any) -> tuple[str, bytes, str]:
    if not isinstance(value, str):
        raise VisionPipelineError("image_invalid", "Ảnh gửi lên không hợp lệ.")
    match = DATA_URL_PATTERN.fullmatch(value.strip())
    if not match:
        raise VisionPipelineError("image_invalid", "Chỉ chấp nhận JPEG, PNG hoặc WebP ở định dạng data URL.")
    mime_type = match.group(1).lower()
    try:
        raw = base64.b64decode(match.group(2), validate=True)
    except (ValueError, binascii.Error):
        raise VisionPipelineError("image_invalid", "Dữ liệu ảnh base64 bị hỏng.") from None
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        raise VisionPipelineError("image_invalid", "Ảnh sau khi tối ưu phải nhỏ hơn 3 MB.")
    if mime_type not in ALLOWED_MIME_TYPES or _magic_mime(raw) != mime_type:
        raise VisionPipelineError("image_invalid", "Nội dung tệp không khớp với loại ảnh đã khai báo.")
    return mime_type, raw, f"data:{mime_type};base64,{base64.b64encode(raw).decode('ascii')}"


def _schema() -> dict[str, Any]:
    nullable_string = {"type": ["string", "null"]}
    object_schema = {
        "type": "object", "additionalProperties": False,
        "required": ["object_name_vi", "object_name_en", "object_name_zh", "category", "brand", "model", "part_number", "visible_text", "evidence", "identification_status"],
        "properties": {
            "object_name_vi": nullable_string, "object_name_en": nullable_string,
            "object_name_zh": nullable_string, "category": nullable_string,
            "brand": nullable_string, "model": nullable_string, "part_number": nullable_string,
            "visible_text": {"type": "array", "items": {"type": "string"}},
            "evidence": {"type": "array", "items": {"type": "string"}},
            "identification_status": {"type": "string", "enum": ["category_identified", "product_identified", "needs_user_confirmation"]},
        },
    }
    return {
        "type": "object", "additionalProperties": False, "required": ["status", "objects"],
        "properties": {
            "status": {"type": "string", "enum": ["product_identified", "needs_user_confirmation", "object_unknown", "multiple_objects_detected"]},
            "objects": {"type": "array", "items": object_schema},
        },
    }


SYSTEM_INSTRUCTIONS = (
    "You are a universal visual object recognition service. Analyze only visible image evidence. "
    "Do not assume objects are automotive. Never invent a brand, model, OEM, part number, coordinates, or numeric confidence. "
    "Set brand, model and part_number to null unless a logo, printed text, or visible image feature supports them; say why in evidence. "
    "A computer mouse must be classified as a computer mouse, not an automotive component. "
    "If no object is identifiable return object_unknown with empty objects. If several distinct objects are visible return multiple_objects_detected. "
    "Use Vietnamese, English and simplified Chinese names when category identification is possible."
)


def _provider_payload(data_url: str) -> dict[str, Any]:
    return {
        "model": os.getenv("OPENAI_VISION_MODEL", "gpt-4.1-mini"), "store": False,
        "input": [{"role": "user", "content": [
            {"type": "input_text", "text": SYSTEM_INSTRUCTIONS},
            {"type": "input_image", "image_url": data_url, "detail": "high"},
        ]}],
        "text": {"format": {"type": "json_schema", "name": "evidence_first_object_recognition", "strict": True, "schema": _schema()}},
    }


def _response_text(response: dict[str, Any]) -> str:
    direct = response.get("output_text")
    if isinstance(direct, str) and direct.strip():
        return direct
    for item in response.get("output", []):
        for content in item.get("content", []):
            if content.get("type") in {"output_text", "text"} and isinstance(content.get("text"), str):
                return content["text"]
    raise VisionPipelineError("recognition_failed", "Dịch vụ Vision không trả về nội dung nhận diện.", 502)


def _is_evidenced(value: str | None, evidence: list[str]) -> bool:
    return not value or any(value.casefold().strip() in item.casefold() for item in evidence)


def normalize_recognition(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or raw.get("status") not in {"product_identified", "needs_user_confirmation", "object_unknown", "multiple_objects_detected"} or not isinstance(raw.get("objects"), list):
        raise VisionPipelineError("recognition_failed", "Phản hồi Vision không đúng định dạng.", 502)
    clean_objects = []
    for index, item in enumerate(raw["objects"][:8]):
        if not isinstance(item, dict):
            continue
        visible_text = [str(x).strip() for x in item.get("visible_text", []) if str(x).strip()][:12]
        evidence = [str(x).strip() for x in item.get("evidence", []) if str(x).strip()][:12]
        obj = {
            "id": f"object_{index + 1}", "object_name_vi": item.get("object_name_vi") or None,
            "object_name_en": item.get("object_name_en") or None, "object_name_zh": item.get("object_name_zh") or None,
            "category": item.get("category") or None, "brand": item.get("brand") or None,
            "model": item.get("model") or None, "part_number": item.get("part_number") or None,
            "visible_text": visible_text, "evidence": evidence,
            "identification_status": item.get("identification_status") or "needs_user_confirmation",
        }
        for field in ("brand", "model", "part_number"):
            if not _is_evidenced(obj[field], evidence + visible_text):
                obj[field] = None
        clean_objects.append(obj)
    if raw["status"] == "object_unknown" or not clean_objects:
        return {"status": "object_unknown", "objects": []}
    return {"status": "multiple_objects_detected" if len(clean_objects) > 1 else raw["status"], "objects": clean_objects}


def recognize_image(data_url: Any, request_id: str | None = None) -> dict[str, Any]:
    _, raw, normalized_data_url = validate_image_data_url(data_url)
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise VisionPipelineError("vision_unavailable", "Vision chưa được cấu hình. Hãy đặt OPENAI_API_KEY trên máy chủ rồi thử lại.", 503)
    request = Request("https://api.openai.com/v1/responses", data=json.dumps(_provider_payload(normalized_data_url)).encode("utf-8"), headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(request, timeout=45) as response:
            provider_response = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        raise VisionPipelineError("vision_unavailable", "Vision không thể xử lý ảnh ở thời điểm này.", 503) from error
    except (URLError, TimeoutError, json.JSONDecodeError):
        raise VisionPipelineError("vision_unavailable", "Không kết nối được dịch vụ Vision.", 503) from None
    result = normalize_recognition(json.loads(_response_text(provider_response)))
    result.update({"request_id": request_id or str(uuid.uuid4()), "image_sha256": hashlib.sha256(raw).hexdigest(), "bounding_boxes_available": False})
    return result
