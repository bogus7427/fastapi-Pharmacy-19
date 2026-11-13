#!/usr/bin/env bash
# 서버에서 실행하는 재배포 스크립트.
#   PC:   git push
#   서버: ./deploy.sh
# GitHub 의 최신 코드를 받아 이미지를 다시 빌드하고 컨테이너를 교체한다.
# 후기 DB(pharmacy-data 볼륨)와 backend/.env 는 건드리지 않는다.
set -euo pipefail

cd "$(dirname "$0")"
BRANCH="${1:-main}"

# docker 그룹 권한이 아직 없는 세션이면 sudo 로 실행한다
if docker info >/dev/null 2>&1; then DOCKER="docker"; else DOCKER="sudo docker"; fi

if [ ! -f backend/.env ]; then
  echo "backend/.env 가 없습니다. backend/.env.example 을 복사해 인증키를 넣으세요." >&2
  exit 1
fi

echo "==> 1/4 최신 코드 받기 ($BRANCH)"
before=$(git rev-parse --short HEAD)
git fetch --quiet origin "$BRANCH"
git checkout --quiet "$BRANCH"
git merge --ff-only --quiet "origin/$BRANCH"
after=$(git rev-parse --short HEAD)
echo "    $before -> $after"

echo "==> 2/4 이미지 빌드 및 컨테이너 교체"
$DOCKER compose up -d --build --remove-orphans

echo "==> 3/4 동작 확인"
ok=""
for _ in $(seq 1 30); do
  if curl -fs -o /dev/null -m 5 http://localhost/api/drugs/popular; then ok=1; break; fi
  sleep 2
done
$DOCKER compose ps
if [ -z "$ok" ]; then
  echo "응답이 없습니다. 최근 로그:" >&2
  $DOCKER compose logs --tail 40 >&2
  exit 1
fi

echo "==> 4/4 쓰지 않는 이미지 정리 (디스크 확보)"
$DOCKER image prune -f >/dev/null
$DOCKER builder prune -f --filter until=168h >/dev/null 2>&1 || true

echo "배포 완료: $after"
