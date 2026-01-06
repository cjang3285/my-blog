import express from 'express';
import { renderMarkdown } from './utils/markdown.js';

const app = express();
app.use(express.json());

// 정적 HTML 제공
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>마크다운 테스터</title>
  <style>
    body { max-width: 1200px; margin: 0 auto; padding: 20px; font-family: sans-serif; }
    .container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    textarea { width: 100%; height: 500px; font-family: monospace; padding: 10px; }
    .preview { border: 1px solid #ccc; padding: 20px; min-height: 500px; background: #f9f9f9; }
    h1 { text-align: center; grid-column: 1 / -1; }
    button { padding: 10px 20px; font-size: 16px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>마크다운 테스터</h1>
  <div class="container">
    <div>
      <h2>마크다운 입력</h2>
      <textarea id="markdown" placeholder="마크다운을 입력하세요..."># 제목

**굵은 글씨** *기울임*

- 리스트 1
- 리스트 2

[링크](https://example.com)

\`\`\`javascript
const code = "test";
\`\`\`

| 컬럼1 | 컬럼2 |
|------|------|
| A    | B    |
</textarea>
      <button onclick="render()">렌더링</button>
    </div>
    <div>
      <h2>HTML 미리보기</h2>
      <div id="preview" class="preview"></div>
    </div>
  </div>
  <script>
    async function render() {
      const markdown = document.getElementById('markdown').value;
      const res = await fetch('/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown })
      });
      const data = await res.json();
      document.getElementById('preview').innerHTML = data.html;
    }

    // 초기 렌더링
    render();
  </script>
</body>
</html>
  `);
});

// 마크다운 렌더링 API
app.post('/render', (req, res) => {
  const { markdown } = req.body;
  const html = renderMarkdown(markdown);
  res.json({ html });
});

app.listen(3333, () => {
  console.log('마크다운 테스터 실행: http://localhost:3333');
});
