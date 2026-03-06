import asyncio

import trafilatura

from backend.ingest.base import IngestResult


def _ingest_sync(url: str) -> IngestResult:
    downloaded = trafilatura.fetch_url(url)
    text = trafilatura.extract(downloaded, include_comments=False, include_tables=False)

    metadata = trafilatura.extract_metadata(downloaded)
    title = (metadata.title if metadata else None) or url
    author = (metadata.author if metadata else None) or ""
    thumbnail = (metadata.image if metadata else None)

    content = f"Title: {title}\nAuthor: {author}\nURL: {url}\n\n{text or 'Could not extract article content.'}"

    return IngestResult(
        title=title,
        content=content,
        content_type="article",
        source_url=url,
        thumbnail=thumbnail,
        meta={"author": author},
    )


async def ingest(url: str) -> IngestResult:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _ingest_sync, url)
