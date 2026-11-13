"""약국 후기 — 사용자가 '이 약국에 이 약이 있었다/없었다, 얼마였다'를 직접 남긴다.
공공데이터에 없는 취급 여부·가격을 사용자 제보로 보완하는 기능.
로그인이 없으므로 글마다 비밀번호를 받아 본인 삭제만 지원한다.
"""
import time
from collections import defaultdict, deque

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator

from .. import db

router = APIRouter(prefix="/api/reviews", tags=["reviews"])

# 도배 방지: IP 당 10분에 5건
_recent: dict[str, deque] = defaultdict(deque)
WINDOW, LIMIT = 600, 5


class ReviewIn(BaseModel):
    pharmacy_key: str = Field(min_length=3, max_length=120)
    pharmacy_name: str = Field(min_length=1, max_length=60)
    drug_name: str = Field(min_length=1, max_length=60)
    in_stock: bool
    price: int | None = Field(None, ge=0, le=10_000_000)
    comment: str = Field("", max_length=500)
    nickname: str = Field(min_length=1, max_length=20)
    password: str = Field(min_length=4, max_length=40)

    @field_validator("pharmacy_name", "drug_name", "comment", "nickname")
    @classmethod
    def strip(cls, v: str) -> str:
        return v.strip()


class ReviewOut(BaseModel):
    id: int
    drug_name: str
    in_stock: bool
    price: int | None
    comment: str
    nickname: str
    created_at: str  # UTC "YYYY-MM-DD HH:MM:SS"


class DrugSummary(BaseModel):
    drug_name: str
    has: int  # '있었음' 제보 수
    none: int  # '없었음' 제보 수
    last_price: int | None  # 가장 최근에 제보된 가격


class ReviewList(BaseModel):
    items: list[ReviewOut]
    total: int
    summary: list[DrugSummary]


class DeleteIn(BaseModel):
    password: str = Field(min_length=1, max_length=40)


def _out(r) -> ReviewOut:
    return ReviewOut(id=r["id"], drug_name=r["drug_name"], in_stock=bool(r["in_stock"]), price=r["price"],
                     comment=r["comment"], nickname=r["nickname"], created_at=r["created_at"])


@router.get("", response_model=ReviewList)
def list_reviews(key: str = Query(min_length=3, max_length=120)):
    with db.connect() as con:
        rows = con.execute(
            "SELECT * FROM reviews WHERE pharmacy_key = ? ORDER BY id DESC LIMIT 100", (key,)
        ).fetchall()
        total = con.execute("SELECT COUNT(*) FROM reviews WHERE pharmacy_key = ?", (key,)).fetchone()[0]
        summary = con.execute(
            """SELECT drug_name, SUM(in_stock) AS has, SUM(1 - in_stock) AS none,
                      (SELECT price FROM reviews r2 WHERE r2.pharmacy_key = r.pharmacy_key
                         AND r2.drug_name = r.drug_name AND r2.price IS NOT NULL
                       ORDER BY r2.id DESC LIMIT 1) AS last_price
               FROM reviews r WHERE pharmacy_key = ? GROUP BY drug_name ORDER BY MAX(id) DESC LIMIT 20""",
            (key,),
        ).fetchall()
    return ReviewList(items=[_out(r) for r in rows], total=total,
                      summary=[DrugSummary(**dict(s)) for s in summary])


@router.post("", response_model=ReviewOut, status_code=201)
def create_review(body: ReviewIn, request: Request):
    if not (body.pharmacy_name and body.drug_name and body.nickname):
        raise HTTPException(422, detail={"code": "EMPTY", "message": "약 이름과 닉네임을 입력해 주세요."})
    ip = request.client.host if request.client else "?"
    now = time.monotonic()
    q = _recent[ip]
    while q and now - q[0] > WINDOW:
        q.popleft()
    if len(q) >= LIMIT:
        raise HTTPException(429, detail={"code": "TOO_MANY", "message": "후기를 너무 자주 등록하고 있습니다. 잠시 후 다시 시도해 주세요."})
    q.append(now)

    salt, pw_hash = db.hash_password(body.password)
    with db.connect() as con:
        cur = con.execute(
            """INSERT INTO reviews (pharmacy_key, pharmacy_name, drug_name, in_stock, price, comment, nickname, pw_salt, pw_hash)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (body.pharmacy_key, body.pharmacy_name, body.drug_name, int(body.in_stock),
             body.price if body.in_stock else None, body.comment, body.nickname, salt, pw_hash),
        )
        row = con.execute("SELECT * FROM reviews WHERE id = ?", (cur.lastrowid,)).fetchone()
    return _out(row)


@router.post("/{review_id}/delete", status_code=204)
def delete_review(review_id: int, body: DeleteIn):
    with db.connect() as con:
        row = con.execute("SELECT pw_salt, pw_hash FROM reviews WHERE id = ?", (review_id,)).fetchone()
        if not row:
            raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "이미 삭제된 후기입니다."})
        if not db.password_matches(body.password, row["pw_salt"], row["pw_hash"]):
            raise HTTPException(403, detail={"code": "BAD_PASSWORD", "message": "비밀번호가 일치하지 않습니다."})
        con.execute("DELETE FROM reviews WHERE id = ?", (review_id,))
