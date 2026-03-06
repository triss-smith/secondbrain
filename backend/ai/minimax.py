import json
from typing import AsyncIterator

import httpx

from backend.config import settings


async def chat_stream(messages: list[dict], system: str | None = None) -> AsyncIterator[str]:
    payload = _build_payload(messages, system, stream=True)
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream(
            "POST",
            f"{settings.minimax_base_url}/chat/completions",
            headers=_headers(),
            json=payload,
        ) as response:
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    delta = chunk["choices"][0]["delta"].get("content", "")
                    if delta:
                        yield delta
                except Exception:
                    continue


async def chat(messages: list[dict], system: str | None = None) -> str:
    payload = _build_payload(messages, system, stream=False)
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            f"{settings.minimax_base_url}/chat/completions",
            headers=_headers(),
            json=payload,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.minimax_api_key}",
        "Content-Type": "application/json",
    }


def _build_payload(messages: list[dict], system: str | None, stream: bool) -> dict:
    payload_messages = []
    if system:
        payload_messages.append({"role": "system", "content": system})
    payload_messages.extend(messages)
    return {
        "model": settings.minimax_model,
        "messages": payload_messages,
        "stream": stream,
        "max_tokens": 2048,
    }
