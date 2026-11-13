"""국립중앙의료원 전국 약국 정보 조회 서비스 — 약국 기본 목록 + 요일별 운영시간 (XML)."""
from datetime import datetime, timedelta, timezone

from .. import config
from ..schemas import DayHours, Pharmacy
from .base import fetch, xml_items

KST = timezone(timedelta(hours=9))
DAYS = ["월", "화", "수", "목", "금", "토", "일", "공휴일"]


def _fmt(hhmm: str) -> str:
    hhmm = hhmm.zfill(4)
    return f"{hhmm[:2]}:{hhmm[2:]}"


def _hours(item: dict) -> list[DayHours]:
    out = []
    for i, day in enumerate(DAYS, start=1):
        s, c = item.get(f"dutyTime{i}s"), item.get(f"dutyTime{i}c")
        if s and c:
            out.append(DayHours(day=day, open=_fmt(s), close=_fmt(c)))
    return out


def open_state(start: str | None, close: str | None, now: datetime | None = None) -> bool | None:
    """현재 영업 여부. 시간 정보가 없으면 None."""
    if not (start and close and start.isdigit() and close.isdigit()):
        return None
    now = now or datetime.now(KST)
    cur, s, c = now.hour * 100 + now.minute, int(start), int(close)
    if c <= s:  # 자정을 넘기는 영업 (예: 2200~0200)
        return cur >= s or cur < c
    return s <= cur < c  # 종료가 2400 이상(심야)인 표기도 그대로 비교된다


def _to_pharmacy(item: dict) -> Pharmacy:
    now = datetime.now(KST)
    idx = now.isoweekday()  # 월=1 … 일=7
    s, c = item.get(f"dutyTime{idx}s"), item.get(f"dutyTime{idx}c")
    hours = _hours(item)
    return Pharmacy(
        id=item.get("hpid", ""),
        name=item.get("dutyName", ""),
        address=item.get("dutyAddr", ""),
        tel=item.get("dutyTel1", ""),
        lat=float(item["wgs84Lat"]) if item.get("wgs84Lat") else None,
        lon=float(item["wgs84Lon"]) if item.get("wgs84Lon") else None,
        hours=hours,
        today_hours=f"{_fmt(s)}~{_fmt(c)}" if s and c else ("오늘 휴무" if hours else None),
        is_open_now=open_state(s, c, now) if s and c else (False if hours else None),
        sources=["국립중앙의료원"],
    )


async def search(sido: str = "", sigungu: str = "", name: str = "", page: int = 1, size: int = 10):
    params = {"pageNo": page, "numOfRows": size, "ORD": "NAME"}
    if sido:
        params["Q0"] = sido
    if sigungu:
        params["Q1"] = sigungu
    if name:
        params["QN"] = name
    items, total = xml_items(await fetch(f"{config.NMC_BASE}/getParmacyListInfoInqire", params))
    return [_to_pharmacy(i) for i in items], total


async def nearby_today_hours(lat: float, lon: float, size: int = 100) -> list[dict]:
    """좌표 주변 약국의 '오늘' 운영시간. 반경 검색(심평원) 결과에 운영시간을 붙이는 용도."""
    items, _ = xml_items(
        await fetch(
            f"{config.NMC_BASE}/getParmacyLcinfoInqire",
            {"WGS84_LAT": lat, "WGS84_LON": lon, "pageNo": 1, "numOfRows": size},
        )
    )
    return items
