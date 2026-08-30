/** 与笔记本重复检测一致：trim + lower + 折叠空白 */
export function normalizeNoteInput(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, '');
}
