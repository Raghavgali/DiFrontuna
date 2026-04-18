from fastapi import APIRouter, Request

router = APIRouter(prefix="/voice", tags=["voice"])


@router.post("/incoming")
async def incoming_call(request: Request):
    """Webhook hit by the telephony provider when a call comes in."""
    raise NotImplementedError


@router.post("/transcript")
async def transcript_chunk(request: Request):
    """Stream/chunk endpoint for STT results during the call."""
    raise NotImplementedError
