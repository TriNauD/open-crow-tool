export const ALLOWED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

/** 解码后约上限（base64 字符数再放宽一点） */
export const MAX_IMAGE_BYTES = 1_200_000;
export const MAX_BASE64_CHARS = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 64;

export type ExplainImagePayload = {
  mimeType: string;
  dataBase64: string;
};

export type ImageValidateResult =
  | { ok: true; mimeType: AllowedImageMime; dataBase64: string }
  | { ok: false; error: string };

export function validateExplainImage(raw: unknown): ImageValidateResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'image payload invalid' };
  }
  const { mimeType, dataBase64 } = raw as ExplainImagePayload;
  if (typeof mimeType !== 'string' || typeof dataBase64 !== 'string') {
    return { ok: false, error: 'image.mimeType and image.dataBase64 are required' };
  }
  const mime = mimeType.toLowerCase() as AllowedImageMime;
  if (!ALLOWED_IMAGE_MIME.includes(mime)) {
    return { ok: false, error: 'unsupported image type (use png/jpeg/webp)' };
  }
  const b64 = dataBase64.replace(/\s/g, '');
  if (!b64) {
    return { ok: false, error: 'image data empty' };
  }
  if (b64.length > MAX_BASE64_CHARS) {
    return { ok: false, error: 'image too large; please use a smaller screenshot' };
  }
  return { ok: true, mimeType: mime, dataBase64: b64 };
}

export function toDataUrl(mimeType: string, dataBase64: string): string {
  return `data:${mimeType};base64,${dataBase64}`;
}
