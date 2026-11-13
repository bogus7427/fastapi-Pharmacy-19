import asyncio
import json

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from .. import db
from ..clients import drug as drug_api
from ..clients.base import PublicApiError, TTLCache
from ..sample_drugs import SAMPLE_DRUGS
from ..schemas import Drug, DrugList

router = APIRouter(prefix="/api/drugs", tags=["drugs"])

NOT_APPROVED_NOTICE = (
    "의약품 정보 API(식약처 e약은요)가 아직 승인되지 않아 샘플 데이터를 표시합니다. "
    "data.go.kr 에서 '의약품개요정보(e약은요)' 활용신청 후 자동으로 실제 데이터로 전환됩니다."
)

# 조회 기록이 쌓이기 전에 캐러셀을 채우는 대표 상비약 (e약은요 제품명 검색어)
STAPLES = ["타이레놀정500", "게보린", "베아제", "훼스탈", "지르텍", "부루펜", "아로나민",
           "이가탄", "둘코락스에스", "판피린티", "겔포스엠", "후시딘연고"]
POPULAR_SIZE = 12
_staples_cache = TTLCache(24 * 3600)


class PopularDrug(BaseModel):
    rank: int
    views: int  # 이 서비스에서의 상세 조회 수. 0 이면 대표 상비약으로 채운 항목
    drug: Drug


class PopularList(BaseModel):
    items: list[PopularDrug]
    based_on_views: bool  # 실제 조회 기록이 하나라도 반영됐는지


@router.get("", response_model=DrugList)
async def search_drugs(
    q: str = Query("", max_length=50),
    symptom: str = Query("", max_length=20),
    page: int = Query(1, ge=1),
    size: int = Query(12, ge=1, le=30),
):
    """q = 제품명 검색, symptom = 효능(증상) 검색. 둘 중 하나는 필요하다."""
    q, symptom = q.strip(), symptom.strip()
    if not (q or symptom):
        raise HTTPException(400, detail={"code": "NO_CONDITION", "message": "약 이름이나 증상을 입력하세요."})
    try:
        items, total = await drug_api.search(q, page, size, symptom)
        return DrugList(items=items, total=total, page=page, source="e약은요")
    except PublicApiError as e:
        if e.code != "NOT_APPROVED":
            raise HTTPException(502, detail={"code": e.code, "message": e.message})
        # 승인 전: 샘플에서 검색 (화면 개발이 막히지 않도록)
        key = (q or symptom).replace(" ", "")
        hits = [d for d in SAMPLE_DRUGS if key in d.name.replace(" ", "") or key in d.efficacy]
        return DrugList(items=hits or SAMPLE_DRUGS, total=len(hits or SAMPLE_DRUGS), page=1,
                        source="sample", notice=NOT_APPROVED_NOTICE)


async def _staples() -> list[Drug]:
    cached = _staples_cache.get("staples")
    if cached is not None:
        return cached

    async def first(name: str) -> Drug | None:
        try:
            items, _ = await drug_api.search(name, 1, 3)
        except PublicApiError:
            return None
        with_image = [d for d in items if d.image]
        return (with_image or items or [None])[0]

    found = [d for d in await asyncio.gather(*[first(n) for n in STAPLES]) if d]
    if found:  # 전부 실패했으면 캐시하지 않고 다음 요청에서 다시 시도
        _staples_cache.set("staples", found)
    return found


@router.get("/popular", response_model=PopularList)
async def popular_drugs():
    """많이 찾는 의약품: 이 서비스의 상세 조회 수 순. 부족한 만큼 대표 상비약으로 채운다."""
    viewed = db.top_viewed(POPULAR_SIZE)
    result = [(Drug(**json.loads(row["data"])), row["count"]) for row in viewed]
    if len(result) < POPULAR_SIZE:
        seen = {d.item_seq for d, _ in result}
        for d in await _staples():
            if d.item_seq not in seen and len(result) < POPULAR_SIZE:
                result.append((d, 0))
    if not result:
        result = [(d, 0) for d in SAMPLE_DRUGS]
    return PopularList(
        items=[PopularDrug(rank=i, views=v, drug=d) for i, (d, v) in enumerate(result, start=1)],
        based_on_views=bool(viewed),
    )


async def _find(item_seq: str) -> Drug | None:
    if item_seq.startswith("SAMPLE-"):
        return next((d for d in SAMPLE_DRUGS if d.item_seq == item_seq), None)
    try:
        return await drug_api.get(item_seq)
    except PublicApiError as e:
        raise HTTPException(502, detail={"code": e.code, "message": e.message})


@router.post("/{item_seq}/view", status_code=204)
async def record_view(item_seq: str):
    """상세 화면을 열 때 호출 — 인기 순위 집계용."""
    if item_seq.startswith("SAMPLE-") or len(item_seq) > 20:
        return
    if db.bump_view(item_seq):
        return
    found = await _find(item_seq)
    if found:
        db.insert_view(item_seq, found.model_dump_json())


@router.get("/{item_seq}", response_model=Drug)
async def get_drug(item_seq: str):
    found = await _find(item_seq)
    if not found:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "해당 의약품을 찾을 수 없습니다."})
    return found
