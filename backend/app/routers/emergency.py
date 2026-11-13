"""응급실 찾기. 국립중앙의료원 응급의료기관 목록에 실시간 가용병상을 붙여서 내려준다."""
from fastapi import APIRouter, HTTPException, Query

from ..clients import er
from ..clients.base import PublicApiError
from ..schemas import EmergencyList

router = APIRouter(prefix="/api/emergency", tags=["emergency"])


@router.get("", response_model=EmergencyList)
async def emergency_by_region(
    sido: str = Query(min_length=2, max_length=20),
    sigungu: str = Query("", max_length=20),
):
    try:
        items, warning = await er.by_region(sido.strip(), sigungu.strip())
    except PublicApiError as e:
        raise HTTPException(502, detail={"code": e.code, "message": e.message})
    return EmergencyList(items=items, total=len(items), warnings=[warning] if warning else [])


@router.get("/nearby", response_model=EmergencyList)
async def emergency_nearby(
    lat: float = Query(ge=33, le=39),
    lon: float = Query(ge=124, le=132),
    limit: int = Query(20, ge=1, le=50),
):
    try:
        items, warnings = await er.nearby(lat, lon, limit)
    except PublicApiError as e:
        raise HTTPException(502, detail={"code": e.code, "message": e.message})
    return EmergencyList(items=items, total=len(items), warnings=warnings)
