#!/usr/bin/env python3
import json
import re
from pathlib import Path

for path in Path("cal").rglob("*.ics"):
    text = path.read_bytes().decode("utf-8")
    text = re.sub(r"^DTSTAMP:.*?\r?\n", "DTSTAMP:20000101T000000Z\r\n", text, flags=re.MULTILINE)
    text = re.sub(r"^LAST-MODIFIED:.*?\r?\n", "", text, flags=re.MULTILINE)
    path.write_bytes(text.encode("utf-8"))

metadata_path = Path("cal/metadata.json")
if metadata_path.exists():
    data = json.loads(metadata_path.read_text(encoding="utf-8"))
    data.pop("generatedAt", None)
    metadata_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
