"""
Podcast ingestion.
- YouTube podcast URLs: use yt-dlp to download audio, then Whisper to transcribe.
- Direct audio file URLs (.mp3/.m4a): download then transcribe.
- Spotify/Apple Podcasts: metadata only (audio not downloadable).
"""
import asyncio
import os
import tempfile

import yt_dlp

from backend.ingest.base import IngestResult


def _ingest_sync(url: str) -> IngestResult:
    u = url.lower()

    # Spotify / Apple — can't download audio
    if "spotify.com" in u or "podcasts.apple.com" in u:
        return _metadata_only(url)

    with tempfile.TemporaryDirectory() as tmpdir:
        audio_path = _download_audio(url, tmpdir)
        if not audio_path:
            return _metadata_only(url)

        title, thumbnail, uploader = _get_metadata(url)
        transcript = _transcribe(audio_path)

    content = f"Title: {title}\nPodcast: {uploader}\n\nTranscript:\n{transcript}"
    return IngestResult(
        title=title,
        content=content,
        content_type="podcast",
        source_url=url,
        thumbnail=thumbnail,
        meta={"uploader": uploader},
    )


def _download_audio(url: str, tmpdir: str) -> str | None:
    output_template = os.path.join(tmpdir, "%(title)s.%(ext)s")
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_template,
        "quiet": True,
        "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3"}],
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        for f in os.listdir(tmpdir):
            if f.endswith(".mp3"):
                return os.path.join(tmpdir, f)
    except Exception:
        pass
    return None


def _get_metadata(url: str) -> tuple[str, str | None, str]:
    try:
        with yt_dlp.YoutubeDL({"skip_download": True, "quiet": True}) as ydl:
            info = ydl.extract_info(url, download=False)
        return (
            info.get("title", "Podcast Episode"),
            info.get("thumbnail"),
            info.get("uploader") or info.get("channel", ""),
        )
    except Exception:
        return "Podcast Episode", None, ""


def _transcribe(audio_path: str) -> str:
    import whisper
    model = whisper.load_model("base")
    result = model.transcribe(audio_path)
    return result.get("text", "")


def _metadata_only(url: str) -> IngestResult:
    title, thumbnail, uploader = _get_metadata(url)
    return IngestResult(
        title=title,
        content=f"Title: {title}\nSource: {url}\n\nAudio not available for transcription.",
        content_type="podcast",
        source_url=url,
        thumbnail=thumbnail,
        meta={"uploader": uploader},
    )


async def ingest(url: str) -> IngestResult:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _ingest_sync, url)
