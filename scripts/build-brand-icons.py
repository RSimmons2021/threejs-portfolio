"""Export the canonical RS SVG to browser/app fallbacks. Requires Pillow.

Run: python3 scripts/build-brand-icons.py /tmp/rs-icon-export.json
The SVG is the editable source; Chromium rasterizes its paths via the companion
browser snippet, avoiding platform font dependencies. Pass its JSON output.
"""
import argparse
import base64
import io
import json
from pathlib import Path
from shutil import copyfile
from xml.etree import ElementTree as ET
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description="Export RS favicon fallbacks from a browser-rendered SVG PNG")
parser.add_argument("source", help="agent-browser --json result from scripts/brand-icon.browser.js")
args = parser.parse_args()
result = json.loads(Path(args.source).read_text())
if not result.get("success"):
    raise ValueError("Browser SVG export failed")
data_url = result["data"]["result"]
source = Image.open(io.BytesIO(base64.b64decode(data_url.split(",", 1)[1]))).convert("RGBA")
if source.size != (512, 512):
    raise ValueError("Expected the canonical SVG rendered at 512 x 512")

sizes = {"favicon-16x16.png": 16, "favicon-32x32.png": 32,
         "apple-touch-icon.png": 180, "android-chrome-192x192.png": 192,
         "android-chrome-256x256.png": 256, "mstile-150x150.png": 150}
for directory in [ROOT / "static/favicon", ROOT / "src/favicon"]:
    for filename, size in sizes.items():
        source.resize((size, size), Image.Resampling.LANCZOS).save(directory / filename, optimize=True)
    source.save(directory / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    if directory != ROOT / "static/favicon":
        copyfile(ROOT / "static/favicon/favicon.svg", directory / "favicon.svg")
    # Safari's pinned tab is a monochrome mask, not the dark icon background.
    icon = ET.parse(ROOT / "static/favicon/favicon.svg")
    for element in list(icon.getroot()):
        if element.tag.endswith("rect"):
            icon.getroot().remove(element)
        elif element.tag.endswith("path"):
            element.set("fill", "#000000")
    ET.register_namespace("", "http://www.w3.org/2000/svg")
    icon.write(directory / "safari-pinned-tab.svg", encoding="unicode")
    print(f"RS icons exported to {directory.relative_to(ROOT)}")
