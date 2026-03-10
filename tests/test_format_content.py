import asyncio
import sys
from unittest.mock import AsyncMock, MagicMock, patch

# Stub heavy prod-only deps that don't work in the dev test environment
for _mod in ("anthropic", "chromadb", "chromadb.config", "sentence_transformers"):
    sys.modules.setdefault(_mod, MagicMock())

import backend.api.items as items_module


def test_format_content_returns_markdown():
    """AI response is returned as-is when it looks like markdown."""
    mock_response = "# Title\n\nSome paragraph.\n\n- bullet one\n- bullet two"
    with patch.object(items_module, "chat", new=AsyncMock(return_value=mock_response)):
        result = asyncio.run(items_module._format_content("Raw flat text content here.", "article"))
    assert result == mock_response


def test_format_content_falls_back_on_failure():
    """Returns original content when the AI call raises."""
    with patch.object(items_module, "chat", new=AsyncMock(side_effect=RuntimeError("no key"))):
        result = asyncio.run(items_module._format_content("Original content.", "note"))
    assert result == "Original content."
