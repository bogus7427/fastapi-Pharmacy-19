"""행정안전부 건강_약국 조회서비스 — 지자체 인허가 기준 영업상태(영업/휴업/폐업) 검증 (JSON)."""
import asyncio
import json
import re

from .. import config
from .base import PublicApiError, TTLCache, fetch, json_items

_region_cache = TTLCache(12 * 3600)  # 인허가 데이터는 하루 1회 갱신
_name_cache = TTLCache(12 * 3600)
MAX_REGION_PAGES = 10  # 지역당 최대 1,000곳


def norm(name: str) -> str:
    return re.sub(r"\s+", "", name or "")


def region_of(address: str) -> str:
    """'서울특별시 강남구 …' → '서울특별시 강남구'"""
    return " ".join((address or "").split()[:2])


async def _page(cond: dict, page: int) -> tuple[list[dict], int]:
    params = {"pageNo": page, "numOfRows": 100, "returnType": "json"}
    params.update({f"cond[{k}]": v for k, v in cond.items()})
    async with _limit:
        text = await fetch(f"{config.MOIS_BASE}/info", params)
    try:
        return json_items(json.loads(text))
    except json.JSONDecodeError as e:
        raise PublicApiError("PARSE", "행안부 응답(JSON)을 해석하지 못했습니다.") from e


_inflight: dict[str, asyncio.Task] = {}
_limit = asyncio.Semaphore(4)  # 행안부 API 는 동시 호출이 많으면 타임아웃이 난다


async def operating_names_in(region: str) -> set[str]:
    """해당 지역에서 '영업/정상' 상태인 약국 이름 집합 (캐시 + 동시 요청 합치기)."""
    cached = _region_cache.get(region)
    if cached is not None:
        return cached
    task = _inflight.get(region)
    if task is None:
        task = _inflight[region] = asyncio.create_task(_load_region(region))
        task.add_done_callback(lambda _: _inflight.pop(region, None))
    return await task


async def _load_region(region: str) -> set[str]:
    cond = {"ROAD_NM_ADDR::LIKE": region, "SALS_STTS_CD::EQ": "01"}
    first, total = await _page(cond, 1)
    pages = min((total + 99) // 100, MAX_REGION_PAGES)
    rest = await asyncio.gather(*[_page(cond, p) for p in range(2, pages + 1)])
    names = {norm(i.get("BPLC_NM", "")) for i in first}
    for items, _ in rest:
        names |= {norm(i.get("BPLC_NM", "")) for i in items}
    _region_cache.set(region, names)
    return names


async def status_by_name(name: str, region: str) -> str | None:
    """약국 한 곳의 인허가 상태명. 못 찾으면 None."""
    key = (norm(name), region)
    cached = _name_cache.get(key)
    if cached is not None:
        return cached or None
    items, _ = await _page({"BPLC_NM::LIKE": name, "ROAD_NM_ADDR::LIKE": region}, 1)
    exact = [i for i in items if norm(i.get("BPLC_NM", "")) == norm(name)]
    # 같은 이름의 폐업 이력이 섞여 있으면 영업 중인 건을 우선한다.
    exact.sort(key=lambda i: i.get("SALS_STTS_CD") != "01")
    status = exact[0].get("SALS_STTS_NM") if exact else ""
    _name_cache.set(key, status or "")
    return status or None
