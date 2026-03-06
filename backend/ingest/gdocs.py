"""
Google Docs ingestion via Google Drive API.
Requires OAuth2 setup — see README for instructions.
The user must complete the OAuth flow at /api/auth/google before this works.
"""
import asyncio
import re

from backend.ingest.base import IngestResult

TOKEN_FILE = "data/google_token.json"
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]


def _extract_doc_id(url: str) -> str | None:
    match = re.search(r"/d/([a-zA-Z0-9_-]+)", url)
    return match.group(1) if match else None


def _ingest_sync(url: str) -> IngestResult:
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    import os

    doc_id = _extract_doc_id(url)
    if not doc_id:
        raise ValueError(f"Could not extract Google Doc ID from URL: {url}")

    if not os.path.exists(TOKEN_FILE):
        raise RuntimeError(
            "Google OAuth not configured. Visit /api/auth/google to authenticate."
        )

    creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    service = build("docs", "v1", credentials=creds)

    doc = service.documents().get(documentId=doc_id).execute()
    title = doc.get("title", "Google Doc")
    content = _extract_text(doc)

    return IngestResult(
        title=title,
        content=content,
        content_type="gdocs",
        source_url=url,
        meta={"doc_id": doc_id},
    )


def _extract_text(doc: dict) -> str:
    text_parts = []
    for element in doc.get("body", {}).get("content", []):
        paragraph = element.get("paragraph")
        if not paragraph:
            continue
        for elem in paragraph.get("elements", []):
            text_run = elem.get("textRun")
            if text_run:
                text_parts.append(text_run.get("content", ""))
    return "".join(text_parts)


async def ingest(url: str) -> IngestResult:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _ingest_sync, url)
