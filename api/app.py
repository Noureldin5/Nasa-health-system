"""FastAPI app factory. Run with: uvicorn app:create_app --factory"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from clock import Clock
from metrics.fake import FakeMetrics
from metrics.port import MetricsPort, MetricsUnavailable
from routes import ai, astronaut, briefs, crew, demo, ground, reference
from routes import link as link_routes
from services.record import Conflict, CrewNotFound, NotFound, Services, reset_demo
from settings import Settings
from store.db import connect
from store.repo import Repo


def make_metrics(settings: Settings) -> MetricsPort:
    if settings.metrics_backend == "fake":
        return FakeMetrics()
    if settings.metrics_backend == "vm":
        from metrics.vm import VmMetrics  # imports C's pipeline package, so only when asked for

        return VmMetrics()
    raise ValueError(f"unknown METRICS_BACKEND {settings.metrics_backend!r}: use 'fake' or 'vm'")


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

    @app.exception_handler(NotFound)
    def not_found(_: Request, exc: NotFound) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(Conflict)
    def conflict(_: Request, exc: Conflict) -> JSONResponse:
        return JSONResponse(status_code=409, content={"detail": str(exc)})

    @app.exception_handler(MetricsUnavailable)
    def metrics_unavailable(_: Request, exc: MetricsUnavailable) -> JSONResponse:
        return JSONResponse(status_code=503, content={"detail": "Time series store unavailable"})

    @app.get("/health", tags=["system"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    for router in (
        astronaut.router,
        briefs.router,
        ground.router,
        crew.router,
        reference.router,
        demo.router,
        link_routes.router,
        ai.router,
    ):
        app.include_router(router)

    if settings.seed_day is not None:
        reset_demo(services, settings.seed_day)
    return app
