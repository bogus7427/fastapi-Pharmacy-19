"""식품의약품안전처 의약품개요정보(e약은요) — 효능·용법·주의사항 (JSON).

주의: 이 API 는 약국 API 3종과 별도로 data.go.kr 에서 활용신청을 해야 한다.
승인 전에는 PublicApiError("NOT_APPROVED") 가 발생하며, 라우터가 샘플 데이터로 대체한다.
"""
import html
import json
import re

from .. import config
from ..schemas import Drug
from .base import PublicApiError, fetch


def _clean(text: str | None) -> str:
    """응답에 섞여 오는 <p>, <sup> 등 HTML 태그 제거."""
    if not text:
        return ""
    text = re.sub(r"</p>|<br\s*/?>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\n{2,}", "\n", html.unescape(text)).strip()


def _to_drug(i: dict) -> Drug:
    return Drug(
        item_seq=str(i.get("itemSeq", "")),
        name=i.get("itemName", ""),
        company=i.get("entpName", "") or "",
        efficacy=_clean(i.get("efcyQesitm")),
        usage=_clean(i.get("useMethodQesitm")),
        warning=_clean(i.get("atpnWarnQesitm")),
        caution=_clean(i.get("atpnQesitm")),
        interaction=_clean(i.get("intrcQesitm")),
        side_effect=_clean(i.get("seQesitm")),
        storage=_clean(i.get("depositMethodQesitm")),
        image=i.get("itemImage") or None,
    )


async def _call(params: dict) -> tuple[list[Drug], int]:
    text = await fetch(f"{config.DRUG_BASE}/getDrbEasyDrugList", {"type": "json", **params})
    try:
        body = json.loads(text).get("body") or {}
    except json.JSONDecodeError as e:
        raise PublicApiError("PARSE", "e약은요 응답(JSON)을 해석하지 못했습니다.") from e
    items = body.get("items") or []
    return [_to_drug(i) for i in items], int(body.get("totalCount") or 0)


async def search(keyword: str = "", page: int = 1, size: int = 10, symptom: str = ""):
    """keyword = 제품명, symptom = 효능 문구(예: 두통) 로 검색."""
    params = {"pageNo": page, "numOfRows": size}
    if keyword:
        params["itemName"] = keyword
    if symptom:
        params["efcyQesitm"] = symptom
    return await _call(params)


async def get(item_seq: str) -> Drug | None:
    items, _ = await _call({"itemSeq": item_seq, "pageNo": 1, "numOfRows": 1})
    return items[0] if items else None
