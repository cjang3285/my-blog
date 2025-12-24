#!/bin/bash

echo "======================================"
echo "완전 재배포 스크립트"
echo "======================================"

cd ~/my-blog

# 1. 최신 코드 확인
echo ""
echo "1. 최신 커밋 확인..."
git log --oneline -1

# 2. PM2 프로세스 완전 종료
echo ""
echo "2. PM2 프로세스 종료..."
pm2 delete all

# 3. Frontend 완전 초기화 및 재빌드
echo ""
echo "3. Frontend 완전 재빌드..."
cd ~/my-blog/frontend
rm -rf dist .astro node_modules/.vite
npm run build

# 4. PM2 재시작
echo ""
echo "4. PM2 재시작..."
cd ~/my-blog
pm2 start ecosystem.config.cjs
pm2 save

# 5. 상태 확인
echo ""
echo "5. 프로세스 상태 확인..."
sleep 3
pm2 status

echo ""
echo "======================================"
echo "재배포 완료!"
echo "======================================"
echo ""
echo "다음 단계:"
echo "1. 브라우저 캐시 삭제 (Ctrl+Shift+Delete)"
echo "2. 또는 시크릿 모드로 테스트"
echo "3. https://chanwook.kr 접속하여 테스트"
echo ""
