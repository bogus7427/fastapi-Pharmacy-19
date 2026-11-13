"""약국 검색. 세 API 의 역할:
- 국립중앙의료원: 지역/이름 검색의 기준 목록 + 요일별 운영시간
- 심평원: 좌표 반경 검색(거리) + 개설일
- 행안부: 인허가 영업상태로 '실제 영업 중인지' 교차 검증
보조 API(행안부 등)가 실패해도 기준 목록은 그대로 내려주고 warnings 로 알린다.
"""
import asyncio
from collections import Counter

from fastapi import APIRouter, HTTPException, Query

from .. import db
from ..clients import hira, mois, nmc
from ..clients.base import PublicApiError
from ..schemas import Pharmacy, PharmacyList

router = APIRouter(prefix="/api/pharmacies", tags=["pharmacies"])


def _attach_reviews(items: list[Pharmacy]) -> None:
    """후기 키와 후기 수를 붙인다."""
    for p in items:
        p.review_key = f"{mois.norm(p.name)}|{mois.region_of(p.address)}"
    counts = db.review_counts([p.review_key for p in items])
    for p in items:
        p.review_count = counts.get(p.review_key, 0)


async def _attach_license(items: list[Pharmacy]) -> str | None:
    """행안부 인허가 상태를 붙인다. 실패 시 경고 문구를 반환."""
    if not items:
        return None
    counts = Counter(mois.region_of(p.address) for p in items)

    async def one(p: Pharmacy):
        region = mois.region_of(p.address)
        if not region:
            return
        if counts[region] >= 3:  # 같은 지역이 여럿이면 지역 단위로 한 번에 조회(캐시)
            names = await mois.operating_names_in(region)
            p.license_status = "영업/정상" if mois.norm(p.name) in names else None
        else:
            p.license_status = await mois.status_by_name(p.name, region)
        if p.license_status:
            p.sources.append("행정안전부")

    results = await asyncio.gather(*[one(p) for p in items], return_exceptions=True)
    errors = [r for r in results if isinstance(r, Exception)]
    for r in errors:
        if not isinstance(r, PublicApiError):
            raise r
    if errors:
        return f"일부 약국의 인허가 상태(행정안전부)를 확인하지 못했습니다: {errors[0].message}"
    return None


@router.get("", response_model=PharmacyList)
async def search_pharmacies(
    sido: str = Query("", max_length=20),
    sigungu: str = Query("", max_length=20),
    name: str = Query("", max_length=30),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=50),
):
    if not (sido or sigungu or name):
        raise HTTPException(400, detail={"code": "NO_CONDITION", "message": "지역 또는 약국 이름을 입력하세요."})
    try:
        items, total = await nmc.search(sido.strip(), sigungu.strip(), name.strip(), page, size)
    except PublicApiError as e:
        raise HTTPException(502, detail={"code": e.code, "message": e.message})
    warning = await _attach_license(items)
    _attach_reviews(items)
    return PharmacyList(items=items, total=total, page=page, warnings=[warning] if warning else [])


@router.get("/nearby", response_model=PharmacyList)
async def nearby_pharmacies(
    lat: float = Query(ge=33, le=39),
    lon: float = Query(ge=124, le=132),
    radius: int = Query(1000, ge=100, le=5000),
):
    warnings: list[str] = []
    try:
        items, total = await hira.nearby(lat, lon, radius)
    except PublicApiError as e:
        raise HTTPException(502, detail={"code": e.code, "message": e.message})

    # 오늘 운영시간(국립중앙의료원)을 이름으로 매칭해 붙인다.
    try:
        today = {mois.norm(i.get("dutyName", "")): i for i in await nmc.nearby_today_hours(lat, lon)}
        for p in items:
            hit = today.get(mois.norm(p.name))
            if hit and hit.get("startTime") and hit.get("endTime"):
                s, c = hit["startTime"], hit["endTime"]
                p.today_hours = f"{s.zfill(4)[:2]}:{s.zfill(4)[2:]}~{c.zfill(4)[:2]}:{c.zfill(4)[2:]}"
                p.is_open_now = nmc.open_state(s, c)
                p.sources.append("국립중앙의료원")
    except PublicApiError as e:
        warnings.append(f"운영시간(국립중앙의료원)을 불러오지 못했습니다: {e.message}")

    warning = await _attach_license(items)
    if warning:
        warnings.append(warning)
    _attach_reviews(items)
    return PharmacyList(items=items, total=total, page=1, warnings=warnings)
