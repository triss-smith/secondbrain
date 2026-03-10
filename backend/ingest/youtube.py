import asyncio
import logging
import os
import re
import tempfile

import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi

from backend.ingest.base import IngestResult

logger = logging.getLogger(__name__)


def _video_id(url: str) -> str | None:
    match = re.search(r"(?:v=|/v/|youtu\.be/|/embed/)([^&?/\s]+)", url)
    return match.group(1) if match else None


def _whisper_transcribe(url: str) -> str:
    """Download audio and transcribe with Whisper."""
    with tempfile.TemporaryDirectory() as tmpdir:
        output_template = os.path.join(tmpdir, "audio.%(ext)s")
        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": output_template,
            "quiet": True,
            "no_warnings": True,
            "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3"}],
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
        except Exception as e:
            logger.warning("Audio download failed for %s: %s", url, e)
            return ""

        audio_path = os.path.join(tmpdir, "audio.mp3")
        if not os.path.exists(audio_path):
            logger.warning("Audio file not found after download for %s", url)
            return ""

        import whisper
        model = whisper.load_model("base")
        result = model.transcribe(audio_path)
        return result.get("text", "")


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
            logger.info("Got captions for %s", video_id)
        except Exception as e:
            logger.warning("Captions unavailable for %s (%s), falling back to Whisper", video_id, e)

    if not transcript_text:
        transcript_text = _whisper_transcribe(url)

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
