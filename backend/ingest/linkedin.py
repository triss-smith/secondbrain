"""
LinkedIn ingestion.
LinkedIn aggressively blocks scraping, so we support paste-based ingestion only.
When a LinkedIn URL is detected, the API returns a prompt asking for pasted content.
"""
from backend.ingest.base import IngestResult


async def ingest(url: str) -> IngestResult:
    raise ValueError(
        "LinkedIn blocks automated access. "
        "Please paste the post content directly instead of using the URL."
    )


def ingest_paste(text: str, url: str | None = None) -> IngestResult:
    first_line = text.strip().split("\n")[0][:100]
    return IngestResult(
        title=first_line or "LinkedIn Post",
        content=text,
        content_type="linkedin",
        source_url=url,
    )
