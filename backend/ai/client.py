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
                    except Exception:
                        continue


async def chat(messages: list[dict], system: str | None = None) -> str:
    s, provider = _provider_config()
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
