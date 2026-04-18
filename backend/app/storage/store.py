from app.models.schemas import Call


class InMemoryStore:
    def __init__(self) -> None:
        self._calls: dict[str, Call] = {}

    def upsert(self, call: Call) -> None:
        self._calls[call.id] = call

    def get_call(self, call_id: str) -> Call | None:
        return self._calls.get(call_id)

    def list_calls(self) -> list[Call]:
        return sorted(self._calls.values(), key=lambda c: c.started_at, reverse=True)


store = InMemoryStore()
