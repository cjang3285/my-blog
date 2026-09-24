import { fetchApi } from '../lib/api.js';

export const prerender = false;

const FEED_SIZE = 20;
const FEED_TITLE = '장찬욱';
const FEED_DESCRIPTION = '라즈베리파이 클러스터를 운영하며 배운 리눅스, 네트워크, 인프라 기록';

const escapeXml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

// 정리 글(article)만 피드에 싣는다. 작업 로그까지 넣으면 구독자 입장에서 소음이 된다.
export async function GET({ site }) {
  const { data, error } = await fetchApi(`/api/posts?page=1&limit=${FEED_SIZE}&category=article`);
  if (error) {
    return new Response('Feed unavailable', { status: 502 });
  }

  const siteUrl = site.href.replace(/\/$/, '');
  const items = data.posts
    .map((post) => {
      const link = `${siteUrl}/blog/${encodeURIComponent(post.slug)}`;
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description>${escapeXml(post.excerpt ?? '')}</description>
${(post.tags ?? []).map((tag) => `      <category>${escapeXml(tag)}</category>`).join('\n')}
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${siteUrl}</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <language>ko</language>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
