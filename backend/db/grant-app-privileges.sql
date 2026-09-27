-- 앱 계정 권한 복구 (pg_restore --no-privileges로 복원한 뒤 1회 실행)
-- 복원 시 GRANT가 빠지면 앱 계정이 시퀀스 USAGE 권한을 잃어 SERIAL 컬럼 INSERT가 전부 실패한다
--   (permission denied for sequence visits_id_seq)
-- 적용: sudo -u postgres psql -d my_blog -v app_user=jcw -f backend/db/grant-app-privileges.sql

GRANT USAGE ON ALL SEQUENCES IN SCHEMA blog, learning TO :"app_user";

-- 이후 postgres가 새로 만드는 시퀀스에도 자동 부여
ALTER DEFAULT PRIVILEGES IN SCHEMA blog, learning GRANT USAGE ON SEQUENCES TO :"app_user";

-- pg_stat_statements에서 다른 계정 쿼리 텍스트까지 조회할 수 있도록
GRANT pg_read_all_stats TO :"app_user";
