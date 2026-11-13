from pydantic import BaseModel


class DayHours(BaseModel):
    day: str  # 월~일, 공휴일
    open: str  # "09:00"
    close: str  # "20:00"


class Pharmacy(BaseModel):
    id: str
    name: str
    address: str = ""
    tel: str = ""
    lat: float | None = None
    lon: float | None = None
    distance_m: int | None = None
    hours: list[DayHours] = []  # 요일별 운영시간 (국립중앙의료원)
    today_hours: str | None = None  # "09:00~20:00"
    is_open_now: bool | None = None  # None = 운영시간 정보 없음
    license_status: str | None = None  # 행안부 인허가 상태. None = 확인 불가
    established: str | None = None  # 개설일 (심평원)
    sources: list[str] = []
    review_key: str = ""  # 후기 묶음 키 (이름+지역). 검색 방식이 달라도 같은 약국이면 같다
    review_count: int = 0


class PharmacyList(BaseModel):
    items: list[Pharmacy]
    total: int
    page: int
    warnings: list[str] = []  # 일부 API 실패 시 사용자에게 보여줄 안내


class Drug(BaseModel):
    item_seq: str
    name: str
    company: str = ""
    efficacy: str = ""  # 효능·효과
    usage: str = ""  # 용법·용량
    warning: str = ""  # 복용 전 반드시 알아야 할 경고
    caution: str = ""  # 주의사항
    interaction: str = ""  # 함께 복용 시 주의할 약/음식
    side_effect: str = ""  # 이상반응
    storage: str = ""  # 보관법
    image: str | None = None
    price: int | None = None  # 원. 공공 API 로는 약국 판매가를 알 수 없어 기본 None
    price_note: str = "약국마다 판매가가 달라 공공데이터로는 제공되지 않습니다."


class DrugList(BaseModel):
    items: list[Drug]
    total: int
    page: int
    source: str  # "e약은요" | "sample"
    notice: str | None = None


class EmergencyRoom(BaseModel):
    id: str
    name: str
    address: str = ""
    tel: str = ""  # 응급실 직통 번호 (없으면 대표 번호)
    er_class: str = ""  # 권역응급의료센터 / 지역응급의료센터 / 지역응급의료기관 / 응급실운영신고기관
    lat: float
    lon: float
    distance_km: float | None = None
    has_realtime: bool = False  # 실시간 병상 정보를 제공하는 기관인지
    beds_available: int | None = None  # 응급실 가용 병상. 음수면 수용 한계를 넘은 상태
    beds_total: int | None = None
    updated_at: str | None = None  # 병상 정보 입력 시각 (KST)
    ct: bool | None = None
    mri: bool | None = None
    ventilator: bool | None = None
    ambulance: bool | None = None


class EmergencyList(BaseModel):
    items: list[EmergencyRoom]
    total: int
    warnings: list[str] = []
