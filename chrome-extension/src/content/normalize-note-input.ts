/** 与 Web `lib/notes/normalize-input.ts` 保持同步 */
export function normalizeNoteInput(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, '');
}
