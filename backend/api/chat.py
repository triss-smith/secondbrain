import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.ai.query import query_stream

router = APIRouter(tags=["chat"])


@router.websocket("/ws/chat")
async def chat_websocket(websocket: WebSocket):
    """
    WebSocket chat endpoint.

    Client sends JSON:
    {
        "question": "What did I learn about X?",
        "item_ids": ["id1", "id2"],   // optional — scopes search to these items
        "history": [                   // optional previous turns
            {"role": "user", "content": "..."},
            {"role": "assistant", "content": "..."}
        ]
    }

    Server streams back text tokens, then sends:
    {"done": true}
    """
    await websocket.accept()
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"error": "Invalid JSON"}))
                continue

            question = payload.get("question", "").strip()
            if not question:
                await websocket.send_text(json.dumps({"error": "question is required"}))
                continue

            item_ids = payload.get("item_ids") or None
            history = payload.get("history") or []

            try:
                async for token in query_stream(question, item_ids=item_ids, history=history):
                    await websocket.send_text(json.dumps({"token": token}))
                await websocket.send_text(json.dumps({"done": True}))
            except Exception as e:
                await websocket.send_text(json.dumps({"error": str(e)}))

    except WebSocketDisconnect:
        pass
