from typing import AsyncIterator

import anthropic

from backend.config import settings


def _client() -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic(
        api_key=settings.minimax_api_key,
        base_url=settings.minimax_base_url,
    )


async def chat_stream(messages: list[dict], system: str | None = None) -> AsyncIterator[str]:
    client = _client()
    async with client.messages.stream(
        model=settings.minimax_model,
        max_tokens=2048,
        system=system or "",
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text


async def chat(messages: list[dict], system: str | None = None) -> str:
    client = _client()
    response = await client.messages.create(
        model=settings.minimax_model,
        max_tokens=2048,
        system=system or "",
        messages=messages,
    )
    return response.content[0].text
