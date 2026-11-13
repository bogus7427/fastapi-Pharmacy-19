FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# 의존성 먼저 설치 (코드만 바뀌면 이 층은 캐시를 재사용한다)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY app ./app

# root 가 아닌 사용자로 실행. 후기 DB(/app/data)는 볼륨으로 연결되므로 미리 소유권을 준다.
RUN useradd --create-home appuser && mkdir -p /app/data && chown -R appuser:appuser /app/data
USER appuser
VOLUME /app/data

EXPOSE 8010

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8010/openapi.json', timeout=4)"

# 워커는 1개: 메모리 캐시와 SQLite 를 쓰고, 프리티어(1GB RAM)에 맞춘다.
# --proxy-headers: nginx 가 넘겨준 실제 접속자 IP 를 인식한다 (후기 도배 방지용).
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8010", "--proxy-headers", "--forwarded-allow-ips", "*"]
