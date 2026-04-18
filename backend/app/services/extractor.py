from app.models.schemas import IncidentFields


async def extract(transcript: str, language: str) -> IncidentFields:
    raise NotImplementedError
