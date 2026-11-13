"""국립중앙의료원 전국 응급의료기관 정보 조회 서비스 (XML).
- getEgytListInfoInqire: 시·도별 응급의료기관 목록 (종별, 좌표, 응급실 전화)
- getEmrrmRltmUsefulSckbdInfoInqire: 응급실 실시간 가용병상
- getEgytLcinfoInqire: 좌표 주변 기관 (여기서는 좌표가 속한 시·도를 알아내는 데만 쓴다)
"""
import asyncio
import math
from datetime import datetime

from .. import config
from ..schemas import EmergencyRoom
from .base import TTLCache, fetch, xml_items

# 예전 행정구역 이름으로 내려오는 주소를 현재 이름으로 맞춘다
_SIDO_ALIAS = {"강원도": "강원특별자치도", "전라북도": "전북특별자치도"}
_CLASS_RANK = {"권역응급의료센터": 0, "지역응급의료센터": 1, "지역응급의료기관": 2}

_list_cache = TTLCache(3600)  # 기관 목록은 거의 바뀌지 않는다
_rt_cache = TTLCache(60)  # 실시간 병상은 1분만 보관
_sido_cache = TTLCache(3600)


def _int(v: str | None) -> int | None:
    try:
        return int(v) if v not in (None, "") else None
    except ValueError:
        return None


def _yn(v: str | None) -> bool | None:
    if not v:
        return None
    return v.upper().startswith("Y")


def _updated(v: str | None) -> str | None:
    """20261113134440 → 2026-11-13T13:44:40"""
    try:
        return datetime.strptime(v or "", "%Y%m%d%H%M%S").isoformat()
    except ValueError:
        return None


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 6371.0 * 2 * math.asin(math.sqrt(a))


async def _institutions(sido: str) -> list[dict]:
    hit = _list_cache.get(sido)
    if hit is None:
        hit, _ = xml_items(
            await fetch(f"{config.ER_BASE}/getEgytListInfoInqire", {"Q0": sido, "pageNo": 1, "numOfRows": 300})
        )
        _list_cache.set(sido, hit)
    return hit


async def _realtime(sido: str) -> dict[str, dict]:
    hit = _rt_cache.get(sido)
    if hit is None:
        items, _ = xml_items(
            await fetch(
                f"{config.ER_BASE}/getEmrrmRltmUsefulSckbdInfoInqire", {"STAGE1": sido, "pageNo": 1, "numOfRows": 300}
            )
        )
        hit = {i.get("hpid", ""): i for i in items}
        _rt_cache.set(sido, hit)
    return hit


def _to_room(item: dict, rt: dict | None) -> EmergencyRoom | None:
    try:
        lat, lon = float(item["wgs84Lat"]), float(item["wgs84Lon"])
    except (KeyError, ValueError):
        return None  # 좌표가 없으면 지도에 찍을 수 없다
    rt = rt or {}
    return EmergencyRoom(
        id=item.get("hpid", ""),
        name=item.get("dutyName", ""),
        address=item.get("dutyAddr", ""),
        tel=item.get("dutyTel3") or item.get("dutyTel1") or "",
        er_class=item.get("dutyEmclsName", ""),
        lat=lat,
        lon=lon,
        has_realtime=bool(rt),
        beds_available=_int(rt.get("hvec")),
        beds_total=_int(rt.get("hvs01")),
        updated_at=_updated(rt.get("hvidate")),
        ct=_yn(rt.get("hvctayn")),
        mri=_yn(rt.get("hvmriayn")),
        ventilator=_yn(rt.get("hvventiayn")),
        ambulance=_yn(rt.get("hvamyn")),
    )


async def by_region(sido: str, sigungu: str = "") -> tuple[list[EmergencyRoom], str | None]:
    """시·도(와 시·군·구)의 응급실. 실시간 병상 조회가 실패해도 목록은 돌려주고 경고를 함께 반환한다."""
    from .base import PublicApiError

    institutions = await _institutions(sido)
    warning = None
    try:
        rt = await _realtime(sido)
    except PublicApiError as e:
        rt, warning = {}, f"실시간 병상 정보를 불러오지 못했습니다: {e.message}"

    rooms = []
    for item in institutions:
        if sigungu and sigungu not in item.get("dutyAddr", ""):
            continue
        room = _to_room(item, rt.get(item.get("hpid", "")))
        if room:
            rooms.append(room)
    rooms.sort(key=lambda r: (_CLASS_RANK.get(r.er_class, 3), r.name))
    return rooms, warning


async def _sidos_near(lat: float, lon: float) -> list[str]:
    key = (round(lat, 2), round(lon, 2))
    hit = _sido_cache.get(key)
    if hit is None:
        items, _ = xml_items(
            await fetch(
                f"{config.ER_BASE}/getEgytLcinfoInqire",
                {"WGS84_LAT": lat, "WGS84_LON": lon, "pageNo": 1, "numOfRows": 15},
            )
        )
        hit = []
        for i in items:
            first = (i.get("dutyAddr") or "").split(" ")[0]
            sido = _SIDO_ALIAS.get(first, first)
            if sido and sido not in hit:
                hit.append(sido)
        hit = hit[:3]  # 시·도 경계 근처면 이웃 시·도까지 본다
        _sido_cache.set(key, hit)
    return hit


async def nearby(lat: float, lon: float, limit: int = 20) -> tuple[list[EmergencyRoom], list[str]]:
    """좌표에서 가까운 순서로 응급실을 돌려준다."""
    sidos = await _sidos_near(lat, lon)
    results = await asyncio.gather(*[by_region(s) for s in sidos])
    rooms: dict[str, EmergencyRoom] = {}
    warnings: list[str] = []
    for found, warning in results:
        if warning and warning not in warnings:
            warnings.append(warning)
        for r in found:
            r = r.model_copy(update={"distance_km": round(distance_km(lat, lon, r.lat, r.lon), 2)})
            rooms[r.id] = r
    ordered = sorted(rooms.values(), key=lambda r: r.distance_km)
    return ordered[:limit], warnings
