import asyncio
import json
import os
import tempfile

import yt_dlp

from backend.ingest.base import IngestResult


def _ingest_sync(url: str) -> IngestResult:
    with tempfile.TemporaryDirectory() as tmpdir:
        # First pass: get metadata + try subtitles
        ydl_opts = {
            "skip_download": True,
            "quiet": True,
            "writesubtitles": True,
            "writeautomaticsub": True,
            "subtitleslangs": ["en", "en-orig", "en-US"],
            "subtitlesformat": "json3/vtt/best",
            "outtmpl": os.path.join(tmpdir, "%(id)s.%(ext)s"),
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)

        title = info.get("title", "TikTok Video")
        thumbnail = info.get("thumbnail")
        uploader = info.get("uploader") or info.get("creator", "")
        description = (info.get("description") or "").strip()

        captions = _read_subtitle_files(tmpdir)

        if not captions:
            # Second pass: download audio and transcribe with Whisper
            captions = _whisper_transcribe(url, tmpdir)

        content_body = captions or description or "No transcript available."

    content = f"Title: {title}\nCreator: {uploader}\n\nTranscript:\n{content_body}"

    return IngestResult(
        title=title,
        content=content,
        content_type="tiktok",
        source_url=url,
        thumbnail=thumbnail,
        meta={"uploader": uploader},
    )


def _whisper_transcribe(url: str, tmpdir: str) -> str:
    try:
        import whisper

        audio_path = os.path.join(tmpdir, "audio.%(ext)s")
        ydl_opts = {
            "format": "bestaudio/best",
            "quiet": True,
            "outtmpl": audio_path,
            "postprocessors": [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
            }],
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        # Find the downloaded audio file
        audio_file = next(
            (os.path.join(tmpdir, f) for f in os.listdir(tmpdir) if f.endswith(".mp3")),
            None,
        )
        if not audio_file:
            return ""

        model = whisper.load_model("base")
        result = model.transcribe(audio_file)
        return result.get("text", "").strip()
    except Exception as e:
        print(f"[tiktok] Whisper transcription failed: {e}")
        return ""


def _read_subtitle_files(tmpdir: str) -> str:
    for filename in sorted(os.listdir(tmpdir)):
        filepath = os.path.join(tmpdir, filename)
        try:
            if filename.endswith(".json3"):
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                texts = []
                for event in data.get("events", []):
                    for seg in event.get("segs", []):
                        t = seg.get("utf8", "").strip()
                        if t and t != "\n":
                            texts.append(t)
                result = " ".join(texts).strip()
                if result:
                    return result
            elif filename.endswith(".vtt"):
                with open(filepath, "r", encoding="utf-8") as f:
                    lines = f.readlines()
                texts = []
                for line in lines:
                    line = line.strip()
                    if line and not line.startswith("WEBVTT") and "-->" not in line and not line.startswith("NOTE") and not line.startswith("Kind:") and not line.startswith("Language:"):
                        texts.append(line)
                result = " ".join(texts).strip()
                if result:
                    return result
        except Exception:
            continue
    return ""


async def ingest(url: str) -> IngestResult:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _ingest_sync, url)
