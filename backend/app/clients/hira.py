"""건강보험심사평가원 약국정보서비스 — 좌표 반경 검색(거리 포함) + 개설일 (JSON)."""
import json

from .. import config
from ..schemas import Pharmacy
from .base import PublicApiError, fetch, json_items


def _to_pharmacy(item: dict) -> Pharmacy:
    est = str(item.get("estbDd") or "")
    dist = item.get("distance")
    return Pharmacy(
        id=str(item.get("ykiho", ""))[:40],
        name=item.get("yadmNm", ""),
        address=item.get("addr", ""),
        tel=item.get("telno", "") or "",
        lat=float(item["YPos"]) if item.get("YPos") else None,
        lon=float(item["XPos"]) if item.get("XPos") else None,
        distance_m=round(float(dist)) if dist else None,
        established=f"{est[:4]}-{est[4:6]}-{est[6:]}" if len(est) == 8 else None,
        sources=["건강보험심사평가원"],
    )


async def nearby(lat: float, lon: float, radius: int = 1000, size: int = 50):
    text = await fetch(
        f"{config.HIRA_BASE}/getParmacyBasisList",
        {"xPos": lon, "yPos": lat, "radius": radius, "pageNo": 1, "numOfRows": size, "_type": "json"},
    )
    try:
        items, total = json_items(json.loads(text))
    except json.JSONDecodeError as e:
        raise PublicApiError("PARSE", "심평원 응답(JSON)을 해석하지 못했습니다.") from e
    result = [_to_pharmacy(i) for i in items]
    result.sort(key=lambda p: p.distance_m if p.distance_m is not None else 10**9)
    return result, total
