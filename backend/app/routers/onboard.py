"""Onboard router - Q&A conversation to generate CanvasConfig."""

import time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request

from app.config import get_model
from app.services.gemini import GeminiService
from app.models.canvas_config import load_defaults
from app.models.ephemeral import OnboardRequest, OnboardResponse
from app.services.prompt_loader import format_history, load_and_fill_prompt
from app.services.session_store import session_store
from app.services.xml_parser import parse_onboard_response
from app.services.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["ephemeral"])


def get_gemini_service(request: Request) -> GeminiService:
    """Dependency to get Gemini service from app state."""
    service = request.app.state.gemini_service
    if not service:
        raise HTTPException(status_code=503, detail="Gemini service not initialized")
    return service


@router.post("/onboard")
async def onboard(
    request_data: OnboardRequest,
    gemini: Annotated[GeminiService, Depends(get_gemini_service)],
) -> OnboardResponse:
    """Handle onboarding Q&A conversation.

    Returns either a follow-up question or a complete CanvasConfig.
    Session is managed server-side - client just needs to pass session_id.

    Model is determined by defaults.models.onboarding (or current config if editing).
    """
    start_time = time.time()
    logger.info(
        "onboard_started",
        session_id=request_data.session_id[:8] + "..." if request_data.session_id else None,
        message_length=len(request_data.message),
    )

    try:
        # Get or create session
        session_id, history = await session_store.get_or_create(request_data.session_id)

        # Load defaults for model selection
        defaults = load_defaults()
        onboarding_model = defaults.get("models", {}).get("onboarding", "pro")
        gemini_model = get_model(onboarding_model)

        # Load and fill the prompt template
        prompt = load_and_fill_prompt(
            "base_onboard",
            conversation_history=format_history(history),
            user_message=request_data.message,
        )

        # Query Gemini
        result = await gemini.query(prompt, model=gemini_model)
        response = result.text

        # Parse the response
        parsed = parse_onboard_response(response)

        # Store messages in session
        await session_store.add_message(session_id, "user", request_data.message)
        content_str = (
            parsed["content"]
            if isinstance(parsed["content"], str)
            else str(parsed["content"])
        )
        await session_store.add_message(session_id, "assistant", content_str)

        elapsed = time.time() - start_time
        logger.info(
            "onboard_completed",
            session_id=session_id[:8] + "...",
            elapsed_seconds=round(elapsed, 3),
            result_type=parsed["type"],
            model=gemini_model,
        )

        return OnboardResponse(
            type=parsed["type"],
            content=parsed["content"],
            session_id=session_id,
        )

    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(
            "onboard_failed",
            elapsed_seconds=round(elapsed, 3),
            error_type=type(e).__name__,
            error=str(e),
        )
        raise HTTPException(status_code=503, detail=f"LLM error: {str(e)}")
