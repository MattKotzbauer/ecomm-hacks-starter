"""Main FastAPI application for Gemini backend."""

import os
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import get_cors_origins, get_server_host, get_server_port
from app.routers import chat, generate, image, images, media, onboard, placement, products, style
from app.services.gemini import GeminiService
from app.services.logging_config import bind_context, clear_context, get_logger, setup_logging

# Load environment variables
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

# Initialize structured logging
setup_logging()
logger = get_logger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all HTTP requests and responses with request tracing."""

    async def dispatch(self, request: Request, call_next):
        # Generate unique request ID for tracing
        request_id = str(uuid.uuid4())[:8]
        start_time = time.time()

        method = request.method
        path = request.url.path
        query_params = dict(request.query_params) if request.query_params else None

        # Bind request context for all subsequent logs
        bind_context(request_id=request_id)

        # Log incoming request
        logger.info(
            "http_request_started",
            method=method,
            path=path,
            query_params=query_params,
        )

        try:
            response = await call_next(request)
            elapsed = time.time() - start_time
            status = response.status_code

            # Log response with appropriate level
            log_method = logger.info if status < 400 else logger.warning if status < 500 else logger.error
            log_method(
                "http_request_completed",
                method=method,
                path=path,
                status_code=status,
                elapsed_seconds=round(elapsed, 3),
            )

            return response
        except Exception as e:
            elapsed = time.time() - start_time
            logger.exception(
                "http_request_failed",
                method=method,
                path=path,
                elapsed_seconds=round(elapsed, 3),
                error_type=type(e).__name__,
                error=str(e),
            )
            raise
        finally:
            # Clear request context to prevent leaking
            clear_context()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan - startup and shutdown."""
    logger.info("server_starting")

    # Initialize Gemini service
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.warning("gemini_api_key_missing", message="GEMINI_API_KEY not set - API calls will fail")

    default_model = os.environ.get("GEMINI_MODEL", "gemini-3-pro-preview")

    try:
        app.state.gemini_service = GeminiService(api_key=api_key, default_model=default_model)
        logger.info("gemini_service_initialized", model=default_model)
    except ValueError as e:
        logger.error("gemini_service_failed", error=str(e))
        app.state.gemini_service = None

    host = get_server_host()
    port = get_server_port()
    logger.info("server_ready", host=host, port=port, url=f"http://{host}:{port}")

    yield

    logger.info("server_shutting_down")


app = FastAPI(
    title="Gemini Backend API",
    description="FastAPI backend for Google Gemini API",
    version="0.1.0",
    lifespan=lifespan,
)

# Request logging middleware (added first, runs last)
app.add_middleware(RequestLoggingMiddleware)

# CORS middleware - origins configurable via CORS_ORIGINS env var
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat.router)
app.include_router(image.router)
app.include_router(media.router)

# Ephemeral canvas routers
app.include_router(onboard.router)
app.include_router(generate.router)
app.include_router(style.router)
app.include_router(images.router)
app.include_router(placement.router)
app.include_router(products.router)


@app.get("/")
async def root():
    """API root - list available endpoints."""
    return {
        "name": "Gemini Backend API",
        "version": "0.1.0",
        "endpoints": {
            # Core Gemini endpoints
            "chat_completions": "POST /api/chat/completions",
            "simple_query": "POST /api/chat/query",
            "list_chat_models": "GET /api/chat/models",
            "generate_image": "POST /api/image/generate",
            "edit_image": "POST /api/image/edit",
            "list_image_models": "GET /api/image/models",
            "multimedia_query": "POST /api/media/query",
            "list_media_types": "GET /api/media/supported-types",
            # Ephemeral canvas endpoints
            "onboard": "POST /api/onboard",
            "generate": "POST /api/generate",
            "style": "POST /api/style",
            "images_search": "GET /api/images/search",
            "images_random": "GET /api/images/random",
            "health": "GET /health",
        },
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=get_server_host(), port=get_server_port())
