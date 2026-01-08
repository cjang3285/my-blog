#!/bin/bash

# 마크다운 기능 진단 스크립트
# 실행: bash check-markdown.sh

echo "======================================"
echo "마크다운 기능 진단 시작"
echo "======================================"
echo ""

# 1단계: 데이터베이스
echo "========== 1. 데이터베이스 체크 =========="
echo ""
echo "[1-1] 스키마 확인:"
sudo -u postgres psql -h localhost -d my_blog -c "\d blog.posts" | grep content
echo ""

echo "[1-2] 데이터 샘플 (첫 번째 포스트):"
sudo -u postgres psql -h localhost -d my_blog -c "SELECT id, title, LEFT(content_markdown, 80) as markdown, LEFT(content_html, 80) as html FROM blog.posts ORDER BY id DESC LIMIT 1"
echo ""

echo "[1-3] content_html 빈 레코드 개수:"
sudo -u postgres psql -h localhost -d my_blog -c "SELECT COUNT(*) as empty_html_count FROM blog.posts WHERE content_html = ''"
echo ""

# 2단계: 백엔드 파일
echo "========== 2. 백엔드 파일 체크 =========="
echo ""
echo "[2-1] utils/markdown.js 존재:"
ls -la ~/my-blog/backend/utils/markdown.js 2>/dev/null && echo "✓ 파일 존재" || echo "✗ 파일 없음"
echo ""

echo "[2-2] postService.js import 확인:"
head -3 ~/my-blog/backend/services/postService.js
echo ""

echo "[2-3] npm 패키지 설치 확인:"
ls ~/my-blog/backend/node_modules/ | grep -E "^marked$" && echo "✓ marked 설치됨" || echo "✗ marked 없음"
ls ~/my-blog/backend/node_modules/ | grep -E "^sanitize-html$" && echo "✓ sanitize-html 설치됨" || echo "✗ sanitize-html 없음"
echo ""

echo "[2-4] package.json 의존성:"
grep -A 8 '"dependencies"' ~/my-blog/backend/package.json
echo ""

# 3단계: API 응답
echo "========== 3. API 응답 체크 =========="
echo ""
echo "[3-1] API 응답 필드:"
curl -s http://localhost:3000/api/posts 2>/dev/null | jq '.[0] | keys' | head -15 || echo "✗ API 응답 실패 (백엔드 미실행?)"
echo ""

echo "[3-2] content_html 내용:"
curl -s http://localhost:3000/api/posts 2>/dev/null | jq -r '.[0] | {id, title, html_length: (.content_html | length), html_sample: (.content_html | .[0:120])}' || echo "✗ API 파싱 실패"
echo ""

# 4단계: 프론트엔드
echo "========== 4. 프론트엔드 체크 =========="
echo ""
echo "[4-1] innerHTML 설정 코드:"
grep -n "innerHTML.*content_html" ~/my-blog/frontend/src/pages/blog/[slug].astro || echo "✗ innerHTML 설정 코드 없음"
echo ""

echo "[4-2] post-body div:"
grep -n 'id="post-body"' ~/my-blog/frontend/src/pages/blog/[slug].astro || echo "✗ post-body div 없음"
echo ""

# 5단계: PM2 상태
echo "========== 5. PM2 프로세스 상태 =========="
pm2 status
echo ""

echo "========== 6. 최근 백엔드 에러 로그 =========="
pm2 logs blog-backend --lines 10 --err --nostream
echo ""

echo "======================================"
echo "진단 완료"
echo "======================================"
echo ""
echo "위 결과를 확인하고 다음을 체크하세요:"
echo "1. DB에 content_markdown, content_html 컬럼이 있는가?"
echo "2. content_html에 HTML 태그가 있는가? (빈 문자열이 아닌가?)"
echo "3. utils/markdown.js 파일이 존재하는가?"
echo "4. marked, sanitize-html 패키지가 설치되었는가?"
echo "5. API 응답에 content_html 필드가 포함되는가?"
echo "6. 프론트엔드에 innerHTML 설정 코드가 있는가?"
echo "7. PM2 프로세스가 정상 실행 중인가?"
echo "8. 백엔드 에러 로그가 있는가?"
