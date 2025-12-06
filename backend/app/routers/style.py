"""Style router - Chat-based visual style modifications."""

import time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request

from app.config import get_model
from app.services.gemini import GeminiService
from app.models.canvas_config import load_defaults
from app.models.ephemeral import StyleRequest, StyleResponse
from app.services.prompt_loader import format_history, load_and_fill_prompt
from app.services.session_store import session_store
from app.services.xml_parser import parse_style_response
from app.services.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["ephemeral"])


def get_gemini_service(request: Request) -> GeminiService:
    """Dependency to get Gemini service from app state."""
    service = request.app.state.gemini_service
    if not service:
        raise HTTPException(status_code=503, detail="Gemini service not initialized")
    return service


def _theme_to_string(theme: dict) -> str:
    """Convert a theme dict to a readable string for the prompt."""
    lines = []
    for key, value in theme.items():
        if value is not None:
            lines.append(f"  {key}: {repr(value)}")
    return "{\n" + ",\n".join(lines) + "\n}"


@router.post("/style")
async def style_chat(
    request_data: StyleRequest,
    gemini: Annotated[GeminiService, Depends(get_gemini_service)],
) -> StyleResponse:
    """Handle style chat - modify visual themes via natural language.

    Takes current theme/physics + user message, returns partial updates.
    Model is determined by defaults.models.chat.
    """
    start_time = time.time()
    logger.info(
        "style_chat_started",
        session_id=request_data.session_id[:8] + "..." if request_data.session_id else None,
        message_length=len(request_data.message),
    )

    try:
        # Get or create session for conversation continuity
        session_id, history = await session_store.get_or_create(
            request_data.session_id
        )

        # Load defaults for model selection
        defaults = load_defaults()
        chat_model = defaults.get("models", {}).get("chat", "flash")
        gemini_model = get_model(chat_model)

        # Format current config for the prompt
        card_theme_str = _theme_to_string(request_data.current_card_theme.model_dump())
        canvas_theme_str = _theme_to_string(request_data.current_canvas_theme.model_dump())
        physics_str = _theme_to_string(request_data.current_physics.model_dump())

        # Load and fill the prompt template
        prompt = load_and_fill_prompt(
            "base_style",
            current_card_theme=card_theme_str,
            current_canvas_theme=canvas_theme_str,
            current_physics=physics_str,
            conversation_history=format_history(history),
            user_message=request_data.message,
        )

        # Query Gemini
        result = await gemini.query(prompt, model=gemini_model)
        response = result.text

        # Parse the response
        parsed = parse_style_response(response)

        # Store messages in session
        await session_store.add_message(session_id, "user", request_data.message)
        explanation = parsed.get("explanation", "")
        await session_store.add_message(session_id, "assistant", explanation)

        elapsed = time.time() - start_time
        logger.info(
            "style_chat_completed",
            session_id=session_id[:8] + "...",
            elapsed_seconds=round(elapsed, 3),
            result_type=parsed["type"],
            model=gemini_model,
        )

        # Build response
        return StyleResponse(
            type=parsed["type"],
            card_theme=parsed.get("card_theme"),
            canvas_theme=parsed.get("canvas_theme"),
            physics=parsed.get("physics"),
            explanation=explanation,
            session_id=session_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(
            "style_chat_failed",
            elapsed_seconds=round(elapsed, 3),
            error_type=type(e).__name__,
            error=str(e),
        )
        raise HTTPException(status_code=503, detail=f"Style chat error: {str(e)}")
