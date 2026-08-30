import { describe, expect, it } from 'vitest';
import { buildEmailHtml } from '@/lib/email';
import { sanitizeGithubRepoUrl, type TrendingRepo } from '@/lib/github-trending';
import type { ReviewedRepo } from '@/lib/email';

function makeRepo(overrides: Partial<ReviewedRepo> = {}): ReviewedRepo {
  return {
    name: 'owner/repo',
    url: 'https://github.com/owner/repo',
    summary: '一句话大白话总结',
    tech_score: 4,
    scene_score: 3,
    tier: '顶级',
    ...overrides,
  };
}

describe('sanitizeGithubRepoUrl', () => {
  it('合法 https://github.com/ 链接原样保留', () => {
    expect(sanitizeGithubRepoUrl('https://github.com/a/b', 'a/b')).toBe('https://github.com/a/b');
    expect(sanitizeGithubRepoUrl('https://github.com/a/b/tree/main', 'a/b')).toBe(
      'https://github.com/a/b/tree/main'
    );
  });

  it('非法协议 / 非法域名 / 空值回退到按 name 拼接', () => {
    expect(sanitizeGithubRepoUrl('javascript:alert(1)', 'a/b')).toBe('https://github.com/a/b');
    expect(sanitizeGithubRepoUrl('http://github.com/a/b', 'a/b')).toBe('https://github.com/a/b');
    expect(sanitizeGithubRepoUrl('https://github.com.evil.com/a/b', 'a/b')).toBe(
      'https://github.com/a/b'
    );
    expect(sanitizeGithubRepoUrl('', 'a/b')).toBe('https://github.com/a/b');
    expect(sanitizeGithubRepoUrl(undefined, 'a/b')).toBe('https://github.com/a/b');
    expect(sanitizeGithubRepoUrl(null, 'a/b')).toBe('https://github.com/a/b');
  });

  it('大小写混写的前缀也认（host 不区分大小写）', () => {
    expect(sanitizeGithubRepoUrl('HTTPS://GITHUB.com/a/b', 'a/b')).toBe('HTTPS://GITHUB.com/a/b');
  });
});

describe('buildEmailHtml（订阅者周报转义）', () => {
  const date = new Date('2026-08-31T00:00:00Z');

  it('AI 产出的 name/summary/url 全量转义，特殊字符不破坏排版、不注入标签', () => {
    const html = buildEmailHtml(
      [
        makeRepo({
          name: 'a/b"><script>alert(1)</script>',
          summary: '含 "引号" 与 <标签> 及 & 符号的一句话',
          url: 'https://github.com/a/b?x=1&y=2',
        }),
      ],
      date
    );

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('含 &quot;引号&quot; 与 &lt;标签&gt; 及 &amp; 符号的一句话');
    expect(html).toContain('href="https://github.com/a/b?x=1&amp;y=2"');
  });

  it('链接可见文本同样转义（→ 后面的 url）', () => {
    const html = buildEmailHtml(
      [makeRepo({ url: 'https://github.com/a/b<c>' })],
      date
    );
    expect(html).toContain('→ https://github.com/a/b&lt;c&gt;');
    expect(html).not.toContain('<c>');
  });

  it('退订链接转义插入', () => {
    const html = buildEmailHtml([makeRepo()], date, 'https://site.example/api/unsubscribe?token=t&x=1');
    expect(html).toContain('href="https://site.example/api/unsubscribe?token=t&amp;x=1"');
  });

  it('正常内容渲染不受转义影响', () => {
    const html = buildEmailHtml([makeRepo()], date);
    expect(html).toContain('>owner/repo</a>');
    expect(html).toContain('一句话大白话总结');
    expect(html).toContain('技术 4/5');
  });
});

describe('TrendingRepo 类型守卫（编译期）', () => {
  it('sanitizeGithubRepoUrl 接受 unknown 并按 name 回退', () => {
    const repo: TrendingRepo = {
      name: 'x/y',
      url: 'https://github.com/x/y',
      description: 'd',
      language: 'TS',
      totalStars: 1,
      weeklyStars: 1,
    };
    expect(sanitizeGithubRepoUrl(repo.url, repo.name)).toBe('https://github.com/x/y');
  });
});
