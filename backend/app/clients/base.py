"""공공데이터포털 공통 호출 유틸: HTTP 클라이언트, 오류 판별, TTL 캐시."""
import re
import time
import xml.etree.ElementTree as ET

import httpx

from .. import config


class PublicApiError(Exception):
    """공공 API 호출 실패. code 로 원인을 구분한다."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


_client: httpx.AsyncClient | None = None


def client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=15.0)
    return _client


async def close_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def fetch(url: str, params: dict) -> str:
    """serviceKey 를 붙여 GET 호출하고 본문 텍스트를 돌려준다."""
    if not config.SERVICE_KEY:
        raise PublicApiError("NO_KEY", "backend/.env 에 DATA_GO_KR_SERVICE_KEY 가 없습니다.")
    try:
        res = await client().get(url, params={"serviceKey": config.SERVICE_KEY, **params})
    except httpx.HTTPError as e:
        raise PublicApiError("NETWORK", f"공공 API 연결 실패: {type(e).__name__}") from e

    text = res.text
    # 게이트웨이 오류는 HTTP 200 이어도 본문에 OpenAPI_ServiceResponse 로 내려온다.
    if "OpenAPI_ServiceResponse" in text or "SERVICE_KEY_IS_NOT_REGISTERED" in text:
        m = re.search(r"SERVICE_KEY_IS_NOT_REGISTERED|LIMITED_NUMBER_OF_SERVICE_REQUESTS|HTTP_ERROR|[A-Z_]{8,}_ERROR", text)
        reason = m.group(0) if m else "UNKNOWN"
        if "NOT_REGISTERED" in reason:
            raise PublicApiError("NOT_APPROVED", "이 API 는 아직 활용신청이 승인되지 않은 인증키입니다.")
        if "LIMITED" in reason:
            raise PublicApiError("QUOTA", "일일 호출 한도를 초과했습니다.")
        raise PublicApiError("GATEWAY", f"공공데이터포털 오류: {reason}")
    if res.status_code >= 400:
        raise PublicApiError("HTTP", f"공공 API 응답 오류 (HTTP {res.status_code})")
    return text


def xml_items(text: str) -> tuple[list[dict], int]:
    """<item> 들을 dict 목록으로, totalCount 와 함께 반환."""
    try:
        root = ET.fromstring(text)
    except ET.ParseError as e:
        raise PublicApiError("PARSE", "공공 API 응답(XML)을 해석하지 못했습니다.") from e
    code = root.findtext("header/resultCode")
    if code not in (None, "00"):
        raise PublicApiError("API", root.findtext("header/resultMsg") or f"resultCode {code}")
    items = [{c.tag: (c.text or "").strip() for c in it} for it in root.iter("item")]
    total = int(root.findtext("body/totalCount") or len(items))
    return items, total


def json_items(data: dict) -> tuple[list[dict], int]:
    """response.body.items.item 구조에서 목록을 꺼낸다 (0건이면 "" , 1건이면 dict 로 오는 경우 처리)."""
    body = (data.get("response") or data).get("body") or {}
    items = body.get("items") or []
    if isinstance(items, dict):
        items = items.get("item") or []
    if isinstance(items, dict):
        items = [items]
    return list(items or []), int(body.get("totalCount") or 0)


class TTLCache:
    def __init__(self, ttl_seconds: float):
        self.ttl = ttl_seconds
        self._data: dict = {}

    def get(self, key):
        hit = self._data.get(key)
        if hit and hit[0] > time.monotonic():
            return hit[1]
        return None

    def set(self, key, value):
        self._data[key] = (time.monotonic() + self.ttl, value)
