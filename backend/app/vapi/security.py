from fastapi import Header, HTTPException, status

from app.config import settings


def verify_vapi_secret(x_vapi_secret: str | None = Header(default=None)) -> None:
    expected = settings.vapi_webhook_secret
    if not expected:
        # Secret unset — dev/local mode. Skip check.
        return
    if x_vapi_secret != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid vapi secret",
        )
