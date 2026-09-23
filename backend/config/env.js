// ESM은 import 문을 모두 먼저 평가한 뒤 본문을 실행하므로, app.js 본문에서
// dotenv.config()를 호출하면 그보다 먼저 로드되는 config/db.js의 Pool이 빈 env로 생성된다.
// 이 모듈을 app.js의 첫 import로 두어 다른 모듈보다 먼저 .env를 로드한다.
import dotenv from 'dotenv';

dotenv.config({ path: './config/.env' });
