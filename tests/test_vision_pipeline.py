import base64
import os
import unittest

from vision_pipeline import VisionPipelineError, normalize_recognition, recognize_image, validate_image_data_url

PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL2cQAAAABJRU5ErkJggg==")
DATA_URL = "data:image/png;base64," + base64.b64encode(PNG).decode()


class VisionPipelineTests(unittest.TestCase):
    def test_valid_image_keeps_full_data(self):
        mime, raw, normalized = validate_image_data_url(DATA_URL)
        self.assertEqual(mime, "image/png")
        self.assertEqual(raw, PNG)
        self.assertEqual(normalized, DATA_URL)

    def test_invalid_content_is_rejected(self):
        bad = "data:image/png;base64," + base64.b64encode(b"not a png").decode()
        with self.assertRaisesRegex(VisionPipelineError, "khớp"):
            validate_image_data_url(bad)

    def test_unevidenced_details_are_removed(self):
        result = normalize_recognition({"status": "product_identified", "objects": [{"object_name_vi": "Chuột máy tính", "object_name_en": "Computer Mouse", "object_name_zh": "电脑鼠标", "category": "Computer Accessories", "brand": "UGREEN", "model": "MU006", "part_number": "85212-0D080", "visible_text": [], "evidence": [], "identification_status": "category_identified"}]})
        obj = result["objects"][0]
        self.assertEqual(obj["object_name_en"], "Computer Mouse")
        self.assertIsNone(obj["brand"])
        self.assertIsNone(obj["model"])
        self.assertIsNone(obj["part_number"])

    def test_no_key_reports_real_unavailable_state(self):
        prior = os.environ.pop("OPENAI_API_KEY", None)
        try:
            with self.assertRaisesRegex(VisionPipelineError, "chưa được cấu hình"):
                recognize_image(DATA_URL, "mouse-request")
        finally:
            if prior:
                os.environ["OPENAI_API_KEY"] = prior


if __name__ == "__main__":
    unittest.main()
