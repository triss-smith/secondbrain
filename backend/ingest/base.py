from dataclasses import dataclass, field
from typing import Optional


@dataclass
class IngestResult:
    title: str
    content: str
    content_type: str
    source_url: Optional[str] = None
    thumbnail: Optional[str] = None
    meta: dict = field(default_factory=dict)


def detect_type(url: str) -> str:
    u = url.lower()
    if "youtube.com" in u or "youtu.be" in u:
        return "youtube"
    if "tiktok.com" in u:
        return "tiktok"
    if "instagram.com" in u:
        return "instagram"
    if "github.com" in u:
        return "github"
    if "docs.google.com" in u:
        return "gdocs"
    if u.endswith(".pdf"):
        return "pdf"
    if "spotify.com/show" in u or "podcasts.apple.com" in u or "anchor.fm" in u:
        return "podcast"
    if "linkedin.com" in u:
        return "linkedin"
    return "article"


async def ingest_url(url: str) -> IngestResult:
    kind = detect_type(url)
    if kind == "youtube":
        from backend.ingest.youtube import ingest
    elif kind == "tiktok":
        from backend.ingest.tiktok import ingest
    elif kind == "instagram":
        from backend.ingest.instagram import ingest
    elif kind == "github":
        from backend.ingest.github import ingest
    elif kind == "gdocs":
        from backend.ingest.gdocs import ingest
    elif kind == "podcast":
        from backend.ingest.podcast import ingest
    elif kind == "linkedin":
        from backend.ingest.linkedin import ingest
    else:
        from backend.ingest.article import ingest
    return await ingest(url)


async def ingest_text(text: str, title: str | None = None) -> IngestResult:
    if not title:
        first_line = text.strip().split("\n")[0].strip()
        title = first_line[:80] if first_line else "Note"
    return IngestResult(title=title, content=text, content_type="note")


async def ingest_file(file_path: str, filename: str) -> IngestResult:
    if filename.lower().endswith(".pdf"):
        from backend.ingest.pdf import ingest
        return await ingest(file_path)
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    return IngestResult(title=filename, content=content, content_type="note")
