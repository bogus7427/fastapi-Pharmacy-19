"""`uvicorn main:app --reload` 로도 실행할 수 있게 해 주는 진입점. 실제 앱은 app/main.py 에 있다."""
from app.main import app  # noqa: F401
