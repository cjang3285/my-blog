// SSR(frontmatter, 엔드포인트)에서 백엔드를 호출할 때 쓰는 내부 주소.
// SSR 코드는 서버 프로세스 안에서 돌기 때문에 nginx를 거치지 않고 백엔드에 직접 붙는다.
// (브라우저 스크립트는 PUBLIC_API_URL 또는 상대 경로를 사용한다)
// 런타임 환경변수 SERVER_API_URL로 바꿀 수 있다 (CI처럼 백엔드를 다른 포트로 띄우는 경우).
const DEFAULT_SERVER_API_URL = 'http://localhost:3000';
export const SERVER_API_URL = process.env.SERVER_API_URL || DEFAULT_SERVER_API_URL;

// 실패 시 예외 대신 { data: null, error }를 돌려줘서 페이지가 부분적으로라도 렌더링되게 한다.
export async function fetchApi(path) {
	try {
		const response = await fetch(`${SERVER_API_URL}${path}`);
		if (!response.ok) {
			return { data: null, error: `HTTP ${response.status}`, status: response.status };
		}
		return { data: await response.json(), error: null, status: response.status };
	} catch (error) {
		return { data: null, error: error.message, status: null };
	}
}
