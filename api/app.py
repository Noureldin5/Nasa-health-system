"""FastAPI app factory. Task 0 skeleton: routes other than /health return 501 until built."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import stubs


def create_app() -> FastAPI:
    app = FastAPI(
        title="Own Your Baseline API",
        version="0.1.0",
        description="Station-server API. Decision support, not a diagnosis.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.get("/health", tags=["system"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(stubs.router)
    return app


app = create_app()
