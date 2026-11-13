"""후기(보유 약 제보) 저장소 — SQLite 파일 하나(backend/data/reviews.db)를 쓴다."""
import hashlib
import hmac
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "data" / "reviews.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS reviews (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    pharmacy_key  TEXT NOT NULL,
    pharmacy_name TEXT NOT NULL,
    drug_name     TEXT NOT NULL,
    in_stock      INTEGER NOT NULL,          -- 1 = 있었음, 0 = 없었음
    price         INTEGER,                   -- 원. 모르면 NULL
    comment       TEXT NOT NULL DEFAULT '',
    nickname      TEXT NOT NULL,
    pw_salt       BLOB NOT NULL,
    pw_hash       BLOB NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_key ON reviews (pharmacy_key, id DESC);

CREATE TABLE IF NOT EXISTS drug_views (       -- 의약품 상세 조회 수 (인기 순위용)
    item_seq   TEXT PRIMARY KEY,
    data       TEXT NOT NULL,                -- Drug JSON (캐러셀에서 바로 쓰기 위해 보관)
    count      INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


@contextmanager
def connect():
    DB_PATH.parent.mkdir(exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()


def init() -> None:
    with connect() as con:
        con.executescript(SCHEMA)


def hash_password(password: str, salt: bytes | None = None) -> tuple[bytes, bytes]:
    salt = salt or os.urandom(16)
    return salt, hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)


def password_matches(password: str, salt: bytes, expected: bytes) -> bool:
    return hmac.compare_digest(hash_password(password, salt)[1], expected)


def review_counts(keys: list[str]) -> dict[str, int]:
    if not keys:
        return {}
    marks = ",".join("?" * len(keys))
    with connect() as con:
        rows = con.execute(
            f"SELECT pharmacy_key, COUNT(*) AS n FROM reviews WHERE pharmacy_key IN ({marks}) GROUP BY pharmacy_key",
            keys,
        ).fetchall()
    return {r["pharmacy_key"]: r["n"] for r in rows}


def bump_view(item_seq: str) -> bool:
    """조회 수 +1. 처음 보는 약이면 False."""
    with connect() as con:
        cur = con.execute(
            "UPDATE drug_views SET count = count + 1, updated_at = datetime('now') WHERE item_seq = ?", (item_seq,)
        )
        return cur.rowcount > 0


def insert_view(item_seq: str, data_json: str) -> None:
    with connect() as con:
        con.execute(
            "INSERT INTO drug_views (item_seq, data) VALUES (?, ?) "
            "ON CONFLICT(item_seq) DO UPDATE SET count = count + 1",
            (item_seq, data_json),
        )


def top_viewed(limit: int) -> list[sqlite3.Row]:
    with connect() as con:
        return con.execute(
            "SELECT data, count FROM drug_views ORDER BY count DESC, updated_at DESC LIMIT ?", (limit,)
        ).fetchall()
