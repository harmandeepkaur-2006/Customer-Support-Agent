import json
import logging
import os
from pathlib import Path
import re

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
ORDERS_FILE = BASE_DIR / "static" / "orders (1).json"
load_dotenv(BASE_DIR / ".env")


def get_valid_order_ids() -> set[str]:
    if ORDERS_FILE.exists():
        try:
            with open(ORDERS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return {item["order_id"].upper() for item in data if isinstance(item, dict) and "order_id" in item}
        except Exception as err:
            logger.error("Error reading orders JSON: %s", err)
    return set()


PROJECT_ENDPOINT = os.getenv("FOUNDRY_PROJECT_ENDPOINT", "").rstrip("/")
AGENT_NAME = os.getenv("FOUNDRY_AGENT_NAME", "")
API_KEY = os.getenv("FOUNDRY_API_KEY", "")
REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "90"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("resolveai")

app = FastAPI(title="ResolveAI", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    conversation_id: str | None = None


class ChatResponse(BaseModel):
    answer: str
    conversation_id: str


def ensure_configured() -> None:
    missing = []
    if not PROJECT_ENDPOINT:
        missing.append("FOUNDRY_PROJECT_ENDPOINT")
    if not AGENT_NAME:
        missing.append("FOUNDRY_AGENT_NAME")
    if not API_KEY or API_KEY == "PASTE_YOUR_API_KEY_HERE":
        missing.append("FOUNDRY_API_KEY")
    if missing:
        raise HTTPException(
            status_code=503,
            detail=f"Missing configuration: {', '.join(missing)}. Add it to the .env file and restart the server.",
        )


def foundry_headers() -> dict[str, str]:
    return {"api-key": API_KEY, "Content-Type": "application/json"}


async def foundry_post(path: str, payload: dict) -> dict:
    url = f"{PROJECT_ENDPOINT}/openai/v1/{path.lstrip('/')}"
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.post(url, headers=foundry_headers(), json=payload)
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="Microsoft Foundry took too long to respond. Please try again.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Could not connect to Microsoft Foundry.") from exc

    if response.is_error:
        try:
            error_body = response.json()
            message = error_body.get("error", {}).get("message") or error_body.get("message") or response.text
        except ValueError:
            message = response.text
        logger.error("Foundry error %s: %s", response.status_code, message)
        if response.status_code in (401, 403):
            detail = "Foundry rejected the credentials. Check your API key and that key authentication is enabled."
        elif response.status_code == 404:
            detail = "Foundry could not find the project or agent. Check the project endpoint and agent name/ID in .env."
        else:
            detail = f"Foundry request failed: {message[:500]}"
        raise HTTPException(status_code=response.status_code, detail=detail)
    return response.json()


async def create_conversation() -> str:
    data = await foundry_post("conversations", {})
    conversation_id = data.get("id")
    if not conversation_id:
        raise HTTPException(status_code=502, detail="Foundry created a conversation without returning its ID.")
    return conversation_id


@app.get("/", include_in_schema=False)
async def index() -> FileResponse:
    return FileResponse(BASE_DIR / "static" / "index.html")


@app.get("/api/health")
async def health() -> dict:
    configured = bool(PROJECT_ENDPOINT and AGENT_NAME and API_KEY and API_KEY != "PASTE_YOUR_API_KEY_HERE")
    return {
        "status": "ok",
        "configured": configured,
        "agent": AGENT_NAME if configured else None,
        "service": "ResolveAI Customer Support",
    }


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    order_matches = re.findall(r"\bORD\d+\b", request.message, flags=re.IGNORECASE)
    if order_matches:
        valid_order_ids = get_valid_order_ids()
        for order_id in order_matches:
            if order_id.upper() not in valid_order_ids:
                return ChatResponse(
                    answer=f"Sorry, no order was found with Order ID {order_id}. Please check the Order ID and try again.",
                    conversation_id=request.conversation_id or "",
                )

    ensure_configured()
    conversation_id = request.conversation_id
    if not conversation_id:
        conversation_id = await create_conversation()

    payload = {
        "conversation": conversation_id,
        "input": request.message.strip(),
        "agent_reference": {
            "name": AGENT_NAME,
            "type": "agent_reference",
        },
    }

    try:
        data = await foundry_post("responses", payload)
    except HTTPException as exc:
        # If an existing conversation expired or was not found, retry once with a fresh conversation
        if exc.status_code in (400, 404) and request.conversation_id:
            logger.warning("Conversation %s invalid or expired. Creating a new one.", conversation_id)
            conversation_id = await create_conversation()
            payload["conversation"] = conversation_id
            data = await foundry_post("responses", payload)
        else:
            raise exc

    answer = data.get("output_text") or extract_output_text(data)
    if not answer:
        logger.error("No text in Foundry response: %s", data)
        raise HTTPException(status_code=502, detail="The agent completed without returning a text answer.")
    return ChatResponse(answer=answer, conversation_id=conversation_id)


def extract_output_text(data: dict) -> str:
    parts: list[str] = []
    for item in data.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            text = content.get("text")
            if isinstance(text, str):
                parts.append(text)
            elif isinstance(text, dict) and isinstance(text.get("value"), str):
                parts.append(text["value"])
    return "\n\n".join(parts).strip()


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app:app", host="localhost", port=port, reload=True)


