from fastapi import APIRouter, HTTPException

from app.storage.store import store

router = APIRouter(prefix="/calls", tags=["calls"])


@router.get("")
def list_calls():
    return store.list_calls()


@router.get("/{call_id}")
def get_call(call_id: str):
    call = store.get_call(call_id)
    if not call:
        raise HTTPException(status_code=404, detail="call not found")
    return call
