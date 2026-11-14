"""Shared FastAPI dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request

from services.record import Services


def get_services(request: Request) -> Services:
    return request.app.state.services


Svc = Annotated[Services, Depends(get_services)]
