import asyncio
import logging
import re

import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi

from backend.ingest.base import IngestResult

logger = logging.getLogger(__name__)


def _video_id(url: str) -> str | None:
    match = re.search(r"(?:v=|/v/|youtu\.be/|/embed/)([^&?/\s]+)", url)
    return match.group(1) if match else None


def _ingest_sync(url: str) -> IngestResult:
    with yt_dlp.YoutubeDL({"skip_download": True, "quiet": True, "no_warnings": True}) as ydl:
        info = ydl.extract_info(url, download=False)

    title = info.get("title", "YouTube Video")
    thumbnail = info.get("thumbnail")
    uploader = info.get("uploader", "")
    duration = info.get("duration")

    video_id = _video_id(url)
    transcript_text = ""

    if video_id:
        try:
            entries = YouTubeTranscriptApi.get_transcript(video_id)
            transcript_text = " ".join(e["text"] for e in entries)
        except Exception as e:
            logger.warning("Transcript fetch failed for %s: %s", video_id, e)
            transcript_text = info.get("description", "")

    if not transcript_text:
        transcript_text = info.get("description", "No transcript available.")

    content = f"Title: {title}\nChannel: {uploader}\n\nTranscript:\n{transcript_text}"

    return IngestResult(
        title=title,
        content=content,
        content_type="youtube",
        source_url=url,
        thumbnail=thumbnail,
        meta={"duration": duration, "uploader": uploader, "video_id": video_id},
    )


async def ingest(url: str) -> IngestResult:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _ingest_sync, url)
