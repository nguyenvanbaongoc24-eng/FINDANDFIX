"""Vercel Python Function for evidence-first image recognition."""

from http.server import BaseHTTPRequestHandler
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from vision_pipeline import VisionPipelineError, recognize_image  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def _json(self, status: int, body: dict) -> None:
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self) -> None:
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 4_200_000:
                raise VisionPipelineError("image_invalid", "Ảnh gửi lên phải nhỏ hơn giới hạn của máy chủ.")
            payload = json.loads(self.rfile.read(size).decode("utf-8"))
            result = recognize_image(payload.get("image"), payload.get("request_id"))
            self._json(200, {"ok": True, **result})
        except VisionPipelineError as error:
            self._json(error.status_code, {"ok": False, "status": error.code, "error": error.message})
        except (ValueError, json.JSONDecodeError):
            self._json(400, {"ok": False, "status": "image_invalid", "error": "Yêu cầu nhận diện không hợp lệ."})

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Allow", "POST, OPTIONS")
        self.end_headers()
