import { describe, expect, it } from 'vitest';
import { validateExplainImage, MAX_BASE64_CHARS } from '@/lib/ai/image-limits';

describe('validateExplainImage', () => {
  it('接受合法 png base64', () => {
    const r = validateExplainImage({ mimeType: 'image/png', dataBase64: 'abc123' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mimeType).toBe('image/png');
  });

  it('拒绝非法 mime / 过大', () => {
    expect(validateExplainImage({ mimeType: 'image/gif', dataBase64: 'x' }).ok).toBe(false);
    expect(
      validateExplainImage({
        mimeType: 'image/jpeg',
        dataBase64: 'x'.repeat(MAX_BASE64_CHARS + 1),
      }).ok
    ).toBe(false);
  });
});
