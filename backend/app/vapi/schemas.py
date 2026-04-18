"""Pydantic shapes for Vapi webhook payloads (inbound) and responses (outbound)."""
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class VapiCustomer(BaseModel):
    number: str | None = None

    model_config = ConfigDict(extra="allow")


class VapiCall(BaseModel):
    id: str
    customer: VapiCustomer | None = None

    model_config = ConfigDict(extra="allow")


class VapiToolFunction(BaseModel):
    name: str
    arguments: dict[str, Any] | str | None = None


class VapiToolCall(BaseModel):
    id: str
    type: str = "function"
    function: VapiToolFunction


class VapiToolCallsMessage(BaseModel):
    type: str
    toolCallList: list[VapiToolCall] = Field(default_factory=list)
    call: VapiCall | None = None

    model_config = ConfigDict(extra="allow")


class VapiToolRequest(BaseModel):
    message: VapiToolCallsMessage


class VapiToolResult(BaseModel):
    toolCallId: str
    result: str | dict[str, Any]


class VapiToolResponse(BaseModel):
    results: list[VapiToolResult]


class VapiEventMessage(BaseModel):
    type: str
    call: VapiCall | None = None

    model_config = ConfigDict(extra="allow")


class VapiEventRequest(BaseModel):
    message: VapiEventMessage
