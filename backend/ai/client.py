import json
from typing import AsyncIterator

import anthropic
import httpx

from backend.store.settings import settings_manager, PROVIDERS


def _provider_config():
    s = settings_manager.get()
    provider = PROVIDERS.get(s.provider, PROVIDERS["minimax"])
    return s, provider


async def chat_stream(messages: list[dict], system: str | None = None) -> AsyncIterator[str]:
    s, provider = _provider_config()
    if not s.api_key:
        raise RuntimeError(f"No API key configured for provider '{s.provider}'. Set one in Settings.")
    if provider["sdk"] == "anthropic":
        async with anthropic.AsyncAnthropic(
            api_key=s.api_key,
            base_url=provider["base_url"],
        ).messages.stream(
            model=s.model,
            max_tokens=2048,
            system=system or "",
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text
    else:
        payload = {
            "model": s.model,
            "messages": [{"role": "system", "content": system or ""}, *messages] if system else messages,
            "stream": True,
            "max_tokens": 2048,
        }
        if not s.enable_thinking:
            payload["thinking"] = {"type": "disabled"}
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{provider['base_url']}/chat/completions",
                headers={"Authorization": f"Bearer {s.api_key}", "Content-Type": "application/json"},
                json=payload,
            ) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    raise RuntimeError(f"API error {response.status_code}: {body.decode()}")
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
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue


async def strip_think_tags(source: AsyncIterator[str]) -> AsyncIterator[str]:
    """Strip <think>...</think> blocks from a streaming token source."""
    in_think = False
    pending = ""

    async for chunk in source:
        pending += chunk
        result = ""

        while True:
            if in_think:
                idx = pending.find("</think>")
                if idx >= 0:
                    pending = pending[idx + 8:]
                    in_think = False
                else:
                    pending = pending[-8:] if len(pending) > 8 else pending
                    break
            else:
                idx = pending.find("<think>")
                if idx >= 0:
                    result += pending[:idx]
                    pending = pending[idx + 7:]
                    in_think = True
                else:
                    safe = len(pending) - 7
                    if safe > 0:
                        result += pending[:safe]
                        pending = pending[safe:]
                    break

        if result:
            yield result

    if not in_think and pending:
        yield pending


async def chat(messages: list[dict], system: str | None = None) -> str:
    s, provider = _provider_config()
    if not s.api_key:
        raise RuntimeError(f"No API key configured for provider '{s.provider}'. Set one in Settings.")
    if provider["sdk"] == "anthropic":
        client = anthropic.AsyncAnthropic(
            api_key=s.api_key,
            base_url=provider["base_url"],
        )
        response = await client.messages.create(
            model=s.model,
            max_tokens=2048,
            system=system or "",
            messages=messages,
        )
        for block in response.content:
            if block.type == "text":
                return block.text
        return ""
    else:
        payload = {
            "model": s.model,
            "messages": [{"role": "system", "content": system or ""}, *messages] if system else messages,
            "max_tokens": 2048,
        }
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{provider['base_url']}/chat/completions",
                headers={"Authorization": f"Bearer {s.api_key}", "Content-Type": "application/json"},
                json=payload,
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
