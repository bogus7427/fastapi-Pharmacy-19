# 약 찾기 · 전국 약국 검색

의약품 복용 정보와 전국 약국(운영시간·위치·후기)을 검색하는 서비스.
프론트는 React(Vite), 백엔드는 FastAPI, 데이터는 공공데이터포털 API 4종을 사용한다.

| API | 용도 |
|---|---|
| 식품의약품안전처 의약품개요정보(e약은요) | 효능·용법·주의사항 |
| 국립중앙의료원 전국 약국 정보 | 약국 목록, 요일별 운영시간 |
| 건강보험심사평가원 약국정보 | 내 위치 반경 검색 |
| 행정안전부 건강_약국 | 인허가 영업상태 확인 |

## 로컬 실행

`backend/.env.example` 을 `backend/.env` 로 복사하고 공공데이터포털 인증키를 넣는다.

```powershell
# 백엔드 (http://localhost:8010)
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8010

# 프론트 (http://localhost:5190)
cd frontend
npm install
npm run dev
```

`http://localhost:8010/api/health` 에서 4개 API 의 승인 상태를 확인할 수 있다.

## 도커 실행

```bash
docker compose up -d --build   # http://localhost (80 포트)
```

인증키는 이미지에 들어가지 않고 `backend/.env` 에서 실행 시 주입된다. 후기 DB 는 `pharmacy-data` 볼륨에 보관된다.
