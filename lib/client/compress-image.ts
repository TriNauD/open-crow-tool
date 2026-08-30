'use client';

import type { AllowedImageMime } from '@/lib/ai/image-limits';

export type CompressedImage = {
  mimeType: AllowedImageMime;
  dataBase64: string;
  previewUrl: string;
};

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.82;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read image failed'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode image failed'));
    img.src = src;
  });
}

/** 浏览器端压缩截图，输出 jpeg/png/webp + base64（不含 data: 前缀） */
export async function compressImageFile(file: Blob): Promise<CompressedImage> {
  const rawUrl = await readAsDataUrl(file);
  const img = await loadImage(rawUrl);

  let { width, height } = img;
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unsupported');
  ctx.drawImage(img, 0, 0, width, height);

  const preferMime: AllowedImageMime =
    file.type === 'image/png' ? 'image/png' : 'image/jpeg';

  const dataUrl = canvas.toDataURL(
    preferMime,
    preferMime === 'image/jpeg' ? JPEG_QUALITY : undefined
  );
  const comma = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, comma);
  const dataBase64 = dataUrl.slice(comma + 1);
  const mimeMatch = /data:(image\/[a-z+]+);/i.exec(header);
  const mimeType = (mimeMatch?.[1]?.toLowerCase() ?? preferMime) as AllowedImageMime;

  const previewUrl = URL.createObjectURL(file);
  return { mimeType, dataBase64, previewUrl };
}
