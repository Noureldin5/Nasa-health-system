"""FastAPI app factory. Run with: uvicorn app:create_app --factory"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from clock import Clock
from metrics.fake import FakeMetrics
from metrics.port import MetricsPort, MetricsUnavailable
from routes import astronaut, crew, demo, ground, reference, stubs
from routes import link as link_routes
from services.record import CrewNotFound, Services, reset_demo
from settings import Settings
from store.db import connect
from store.repo import Repo


def make_metrics(settings: Settings) -> MetricsPort:
    if settings.metrics_backend == "fake":
        return FakeMetrics()
    raise NotImplementedError(
        f"metrics backend {settings.metrics_backend!r} arrives with the pipeline integration"
    )


def create_app(settings: Settings | None = None, clock: Clock | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
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
    services = Services(
        repo=Repo(connect(settings.sqlite_path)),
        metrics=make_metrics(settings),
        clock=clock or Clock(),
        settings=settings,
    )
    app.state.services = services

    @app.exception_handler(CrewNotFound)
    def crew_not_found(_: Request, exc: CrewNotFound) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": f"Crew member {exc} not found"})

    @app.exception_handler(MetricsUnavailable)
    def metrics_unavailable(_: Request, exc: MetricsUnavailable) -> JSONResponse:
        return JSONResponse(status_code=503, content={"detail": "Time series store unavailable"})

    @app.get("/health", tags=["system"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    for router in (
        astronaut.router,
        ground.router,
        crew.router,
        reference.router,
        demo.router,
        link_routes.router,
    ):
        app.include_router(router)
    app.include_router(stubs.router)

    if settings.seed_day is not None:
        reset_demo(services, settings.seed_day)
    return app
