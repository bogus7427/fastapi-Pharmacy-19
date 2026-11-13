from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config, db
from .clients import drug, er, hira, mois, nmc
from .clients.base import PublicApiError, close_client
from .routers import drugs, emergency, pharmacies, reviews


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init()
    yield
    await close_client()


app = FastAPI(title="약국·의약품 검색 API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_ORIGIN],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
app.include_router(drugs.router)
app.include_router(pharmacies.router)
app.include_router(reviews.router)
app.include_router(emergency.router)


@app.get("/api/health")
async def health():
    """5개 공공 API 의 연결·승인 상태를 한 번에 점검한다. (개발 첫 단계에서 확인용)"""

    async def check(coro):
        try:
            await coro
            return {"ok": True}
        except PublicApiError as e:
            return {"ok": False, "code": e.code, "message": e.message}

    return {
        "국립중앙의료원_약국정보": await check(nmc.search(name="온누리", size=1)),
        "심평원_약국정보": await check(hira.nearby(37.4979, 127.0276, 300, size=1)),
        "행안부_약국인허가": await check(mois._page({"SALS_STTS_CD::EQ": "01"}, 1)),
        "식약처_e약은요": await check(drug.search("타이레놀", size=1)),
        "국립중앙의료원_응급의료기관": await check(er._institutions("세종특별자치시")),
    }
