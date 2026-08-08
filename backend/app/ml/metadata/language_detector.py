import re
from typing import Tuple, Optional


class SimpleLanguageDetector:
    def detect_from_text(self, title: str, lyrics: Optional[str] = None) -> Tuple[Optional[str], float]:
        text = f"{title} {lyrics or ''}".strip()
        if not text:
            return None, 0.0

        if re.search(r'[\u3040-\u30ff\u4e00-\u9faf]', text):
            return "ja", 0.92
        if re.search(r'[\u4e00-\u9fff]', text):
            return "zh", 0.90
        if re.search(r'[\u0400-\u04FF]', text):
            return "ru", 0.88
        if re.search(r'[\u0600-\u06FF]', text):
            return "ar", 0.88
        if re.search(r'[a-zA-Z]', text):
            return "en", 0.75

        return None, 0.0