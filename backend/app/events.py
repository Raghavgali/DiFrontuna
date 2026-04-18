"""In-process pub/sub for fanning call events out to WebSocket subscribers."""
import asyncio
from typing import Any

_subscribers: list[asyncio.Queue] = []


def subscribe() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue()
    _subscribers.append(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    if q in _subscribers:
        _subscribers.remove(q)


async def publish(event_type: str, payload: dict[str, Any]) -> None:
    message = {"type": event_type, "payload": payload}
    for q in list(_subscribers):
        await q.put(message)
