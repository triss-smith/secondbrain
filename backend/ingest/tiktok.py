import asyncio

import yt_dlp

from backend.ingest.base import IngestResult


def _ingest_sync(url: str) -> IngestResult:
    ydl_opts = {
        "skip_download": True,
        "quiet": True,
        "writesubtitles": True,
        "writeautomaticsub": True,
        "subtitleslangs": ["en"],
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    title = info.get("title", "TikTok Video")
    thumbnail = info.get("thumbnail")
    uploader = info.get("uploader") or info.get("creator", "")
    description = info.get("description", "")

    # TikTok often has captions available
    captions = _extract_captions(info)
    content_body = captions or description or "No transcript available."

    content = f"Title: {title}\nCreator: {uploader}\n\nCaption/Description:\n{content_body}"

    return IngestResult(
        title=title,
        content=content,
        content_type="tiktok",
        source_url=url,
        thumbnail=thumbnail,
        meta={"uploader": uploader},
    )


def _extract_captions(info: dict) -> str:
    for sub_dict in [info.get("subtitles", {}), info.get("automatic_captions", {})]:
        for lang in ["en", "en-US"]:
            if lang in sub_dict:
                entries = sub_dict[lang]
                # yt-dlp returns subtitle data; try to get text
                for entry in entries:
                    if isinstance(entry, dict) and "data" in entry:
                        return entry["data"]
    return ""


async def ingest(url: str) -> IngestResult:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _ingest_sync, url)
