import { describe, expect, it } from 'vitest';
import {
  FetchSafeError,
  assertSafeHttpUrl,
  isPrivateOrReservedIp,
} from '@/lib/url/fetch-safe';

describe('SSRF guards', () => {
  it('标记私网 / 保留 IP', () => {
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('10.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true);
    expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true);
    expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
  });

  it('拒绝危险 URL 形态', () => {
    expect(() => assertSafeHttpUrl('ftp://example.com')).toThrow(FetchSafeError);
    expect(() => assertSafeHttpUrl('http://127.0.0.1/x')).toThrow(FetchSafeError);
    expect(() => assertSafeHttpUrl('http://user:pass@example.com')).toThrow(FetchSafeError);
    expect(() => assertSafeHttpUrl('http://localhost/a')).toThrow(FetchSafeError);
    expect(assertSafeHttpUrl('https://example.com/a').hostname).toBe('example.com');
  });
});
