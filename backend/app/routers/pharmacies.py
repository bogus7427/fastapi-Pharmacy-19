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
NEARBY_WAIT = 2.5  # 주변 검색에서 두 API 를 함께 기다리는 시간(초)
LICENSE_WAIT = 4.0  # 행안부 인허가 확인을 기다리는 최대 시간(초)
_background: set[asyncio.Task] = set()  # 응답 뒤에도 계속 도는 인허가 조회 (참조를 잡아 둔다)


def _finish_background(task: asyncio.Task) -> None:
    _background.discard(task)
    if not task.cancelled():
        task.exception()  # 결과를 읽어 "exception was never retrieved" 경고를 막는다


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

    # 행안부 API 는 처음 조회하는 지역이면 10초 넘게 걸릴 때가 있다. LICENSE_WAIT 초까지만 기다리고,
    # 늦는 조회는 취소하지 않고 뒤에서 마저 끝내 캐시를 채운다 (다음 검색부터는 바로 붙는다).
    tasks = [asyncio.ensure_future(one(p)) for p in items]
    done, pending = await asyncio.wait(tasks, timeout=LICENSE_WAIT)
    for t in pending:
        _background.add(t)
        t.add_done_callback(_finish_background)
    errors = [t.exception() for t in done if t.exception()]
    for r in errors:
        if not isinstance(r, PublicApiError):
            raise r
    if errors:
        return f"일부 약국의 인허가 상태(행정안전부)를 확인하지 못했습니다: {errors[0].message}"
    if pending:
        return "행정안전부 응답이 늦어 일부 약국의 인허가 상태를 아직 붙이지 못했습니다. 잠시 후 다시 검색하면 표시됩니다."
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

    # 심평원(반경 검색)과 국립중앙의료원(위치 기반 + 오늘 운영시간)을 동시에 부른다.
    # 두 API 모두 응답이 10초를 넘길 때가 있어서, NEARBY_WAIT 초 안에 온 것만으로 먼저 답한다.
    # 그 안에 아무것도 안 오면 둘 중 하나가 올 때까지만 더 기다린다.
    t_hira = asyncio.ensure_future(hira.nearby(lat, lon, radius))
    t_nmc = asyncio.ensure_future(nmc.nearby_today_hours(lat, lon))

    def usable(t: asyncio.Task) -> bool:
        return t.done() and not t.cancelled() and t.exception() is None

    await asyncio.wait({t_hira, t_nmc}, timeout=NEARBY_WAIT)
    while not (usable(t_hira) or usable(t_nmc)) and not (t_hira.done() and t_nmc.done()):
        await asyncio.wait({t for t in (t_hira, t_nmc) if not t.done()}, return_when=asyncio.FIRST_COMPLETED)
    for t in (t_hira, t_nmc):
        if not t.done():
            t.cancel()
        elif t.exception() and not isinstance(t.exception(), PublicApiError):
            raise t.exception()
    hira_ok, nmc_ok = usable(t_hira), usable(t_nmc)

    if not hira_ok and not nmc_ok:
        e = t_nmc.exception()
        raise HTTPException(502, detail={"code": e.code, "message": e.message})
    hira_res = t_hira.result() if hira_ok else None
    nmc_res = t_nmc.result() if nmc_ok else None

    if hira_ok:
        items, total = hira_res
        if nmc_ok:  # 오늘 운영시간을 이름으로 매칭해 붙인다
            today = {mois.norm(i.get("dutyName", "")): i for i in nmc_res}
            for p in items:
                hit = today.get(mois.norm(p.name))
                if hit and hit.get("startTime") and hit.get("endTime"):
                    s, c = hit["startTime"], hit["endTime"]
                    p.today_hours = f"{s.zfill(4)[:2]}:{s.zfill(4)[2:]}~{c.zfill(4)[:2]}:{c.zfill(4)[2:]}"
                    p.is_open_now = nmc.open_state(s, c)
                    p.sources.append("국립중앙의료원")
        else:
            warnings.append("국립중앙의료원 응답이 늦어 오늘 운영시간을 붙이지 못했습니다. 잠시 후 다시 검색해 보세요.")
    else:
        items = [p for p in (nmc.from_location_item(i) for i in nmc_res) if p.distance_m is not None and p.distance_m <= radius][:50]
        total = len(items)

    warning = await _attach_license(items)
    if warning:
        warnings.append(warning)
    _attach_reviews(items)
    return PharmacyList(items=items, total=total, page=1, warnings=warnings)
