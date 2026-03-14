import asyncio
import logging

import trafilatura

from backend.ingest.base import IngestResult

logger = logging.getLogger(__name__)

_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


def _ingest_sync(url: str) -> IngestResult:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise ValueError("Playwright is required to ingest X posts. Run: playwright install chromium")

    with sync_playwright() as p:
        browser = p.chromium.launch(
            args=["--disable-blink-features=AutomationControlled"]
        )
        context = browser.new_context(
            user_agent=_BROWSER_HEADERS["User-Agent"],
            viewport={"width": 1920, "height": 1080},
            extra_http_headers=_BROWSER_HEADERS,
        )
        page = context.new_page()
        page.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        try:
            page.goto(url, wait_until="load", timeout=30_000)
            page.wait_for_timeout(2000)
            html = page.content()
        except Exception as e:
            raise ValueError(f"Could not load X post: {e}")
        finally:
            browser.close()

    text = trafilatura.extract(html, include_comments=False, include_tables=False)
    metadata = trafilatura.extract_metadata(html)

    raw_title = (metadata.title if metadata else None) or ""
    # X title format: "Display Name on X: "tweet text..." / X"
    # Extract just "Display Name on X" as the title
    clean_title = raw_title.removesuffix(" / X").strip()
    if ': "' in clean_title:
        clean_title = clean_title.split(': "')[0].strip()
    title = clean_title or url

    # Extract display name from "Display Name on X"
    author = (metadata.author if metadata else None) or ""
    if not author and " on X" in title:
        author = title.replace(" on X", "").strip()

    thumbnail = (metadata.image if metadata else None)

    content = f"Author: {author}\nURL: {url}\n\n{text or 'Could not extract post content.'}"

    return IngestResult(
        title=title,
        content=content,
        content_type="article",
        source_url=url,
        thumbnail=thumbnail,
        meta={"author": author, "generate_title": True},
    )


async def ingest(url: str) -> IngestResult:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _ingest_sync, url)
