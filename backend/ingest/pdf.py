import asyncio

from backend.ingest.base import IngestResult


def _ingest_sync(file_path: str) -> IngestResult:
    import fitz  # PyMuPDF

    doc = fitz.open(file_path)
    pages_text = []
    for page in doc:
        pages_text.append(page.get_text())
    doc.close()

    full_text = "\n\n".join(pages_text)
    title = _guess_title(full_text, file_path)

    return IngestResult(
        title=title,
        content=full_text,
        content_type="pdf",
        source_url=None,
        thumbnail=None,
        meta={"page_count": len(pages_text)},
    )


def _guess_title(text: str, file_path: str) -> str:
    first_line = text.strip().split("\n")[0].strip()
    if 5 < len(first_line) < 120:
        return first_line
    import os
    return os.path.basename(file_path).replace(".pdf", "")


async def ingest(file_path: str) -> IngestResult:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _ingest_sync, file_path)
