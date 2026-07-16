from __future__ import annotations

from functools import lru_cache

from app.config import get_settings
from app.services.competitor import CompetitorService
from app.services.llm import LLMService
from app.services.traffic import TrafficService


@lru_cache
def get_traffic_service() -> TrafficService:
    return TrafficService(get_settings())


@lru_cache
def get_llm_service() -> LLMService:
    return LLMService(get_settings())


@lru_cache
def get_competitor_service() -> CompetitorService:
    return CompetitorService(get_settings())
