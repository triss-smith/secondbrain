import asyncio
import logging

import requests
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


def _fetch_with_requests(url: str) -> str | None:
    try:
        response = requests.get(url, headers=_BROWSER_HEADERS, timeout=15)
        response.raise_for_status()
        return response.text
    except Exception as e:
        logger.debug("[article] requests fetch failed for %s: %s", url, e)
        return None


def _fetch_with_playwright(url: str) -> str | None:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        logger.warning("[article] playwright not installed, skipping headless fallback")
        return None
    try:
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
            page.goto(url, wait_until="load", timeout=30_000)
            page.wait_for_timeout(2000)
            content = page.content()
            browser.close()
            return content
    except Exception as e:
        logger.warning("[article] playwright fetch failed for %s: %s", url, e, exc_info=True)
        return None


def _ingest_sync(url: str) -> IngestResult:
    downloaded = _fetch_with_requests(url)

    if downloaded is None:
        logger.info("[article] requests failed, trying playwright for %s", url)
        downloaded = _fetch_with_playwright(url)

    if downloaded is None:
        raise ValueError(
            f"Could not fetch content from {url}. "
            "The site may block automated access."
        )

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
