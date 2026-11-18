"""Build dist/index.html: one self-contained page from the files in src/."""
from pathlib import Path
root = Path(__file__).parent
page = (root / "src/index.html").read_text()
for marker, name in [("/*DATA*/", "data.js"), ("/*ENGINE*/", "engine.js"), ("/*APP*/", "app.js")]:
    page = page.replace(marker, (root / "src" / name).read_text())
(root / "dist").mkdir(exist_ok=True)
(root / "dist/index.html").write_text(page)
print("Built dist/index.html", len(page) // 1024, "KB")
