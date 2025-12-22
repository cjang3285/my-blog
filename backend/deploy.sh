#!/bin/bash

# Blog Backend 배포 스크립트
# 이 스크립트는 백엔드 서버를 업데이트하고 재시작합니다.

set -e  # 에러 발생 시 스크립트 중단

echo "🚀 Blog Backend 배포 시작..."

# 1. Git pull
echo "📥 최신 코드 가져오기..."
git pull origin main

# 2. 의존성 설치
echo "📦 의존성 설치 중..."
cd backend
npm install --production

# 3. .env 파일 확인
if [ ! -f .env ]; then
    echo "⚠️  .env 파일이 없습니다. .env.example을 복사하여 .env 파일을 생성하고 설정해주세요."
    echo "예: cp .env.example .env"
    exit 1
fi

# 4. logs 디렉토리 생성
mkdir -p logs

# 5. PM2로 서버 재시작 (또는 시작)
echo "🔄 서버 재시작 중..."
if pm2 describe blog-backend > /dev/null 2>&1; then
    pm2 reload ecosystem.config.js --env production
    echo "✅ 서버가 재시작되었습니다."
else
    pm2 start ecosystem.config.js --env production
    echo "✅ 서버가 시작되었습니다."
fi

# 6. PM2 상태 확인
echo "📊 서버 상태:"
pm2 status

echo "🎉 배포 완료!"
echo ""
echo "유용한 명령어:"
echo "  - 로그 보기: pm2 logs blog-backend"
echo "  - 서버 중지: pm2 stop blog-backend"
echo "  - 서버 재시작: pm2 restart blog-backend"
echo "  - 상태 확인: pm2 status"
