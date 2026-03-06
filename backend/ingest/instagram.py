import asyncio

import yt_dlp

from backend.ingest.base import IngestResult


def _ingest_sync(url: str) -> IngestResult:
    ydl_opts = {"skip_download": True, "quiet": True}

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    title = info.get("title") or info.get("description", "Instagram Reel")[:80]
    thumbnail = info.get("thumbnail")
    uploader = info.get("uploader") or info.get("channel", "")
    description = info.get("description", "")

    content = f"Title: {title}\nCreator: {uploader}\n\nCaption:\n{description}"

    return IngestResult(
        title=title,
        content=content,
        content_type="instagram",
        source_url=url,
        thumbnail=thumbnail,
        meta={"uploader": uploader},
    )


async def ingest(url: str) -> IngestResult:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _ingest_sync, url)
