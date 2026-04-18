from app.models.schemas import TriageResult


async def classify(transcript: str, language: str) -> TriageResult:
    """Classify the call as emergency / urgent-non-emergency / standard."""
    raise NotImplementedError
