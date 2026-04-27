import { describe, expect, it } from 'vitest';
import { samePageOrigin } from '@/lib/utils/same-page-origin';

describe('samePageOrigin（连接插件 postMessage 校验）', () => {
  it('同协议同 host 同端口为同源', () => {
    expect(samePageOrigin('http://localhost:3000', 'http://localhost:3000')).toBe(true);
  });

  it('路径不同仍算同源', () => {
    expect(samePageOrigin('http://localhost:3000/notebook', 'http://localhost:3000')).toBe(true);
  });

  it('端口不同为不同源', () => {
    expect(samePageOrigin('http://localhost:3001', 'http://localhost:3000')).toBe(false);
  });

  it('非法 URL 为 false', () => {
    expect(samePageOrigin('not-a-url', 'http://localhost:3000')).toBe(false);
  });
});
