import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

SERVICE_KEY = os.getenv("DATA_GO_KR_SERVICE_KEY", "")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5190")

# 공공데이터포털 엔드포인트 (2026-11 실제 호출로 확인)
NMC_BASE = "http://apis.data.go.kr/B552657/ErmctInsttInfoInqireService"  # 국립중앙의료원
HIRA_BASE = "http://apis.data.go.kr/B551182/pharmacyInfoService"  # 건강보험심사평가원
MOIS_BASE = "https://apis.data.go.kr/1741000/pharmacies"  # 행정안전부
DRUG_BASE = "http://apis.data.go.kr/1471000/DrbEasyDrugInfoService"  # 식약처 e약은요 (별도 활용신청 필요)
