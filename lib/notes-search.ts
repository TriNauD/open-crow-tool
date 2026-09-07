import type { NoteEntry } from '@/lib/db/notes';

/**
 * 笔记关键词过滤（登录用户与游客共用）。
 * 笔记本页本就全量拉取笔记到前端，搜索直接在本地过滤：
 * - 关键词含逗号、%、_ 等特殊字符也安全（此前后端 .or() 拼接会被这些字符打出 400）；
 * - 无需请求往返，输入即时生效。
 */
export function filterNotesByKeyword(notes: NoteEntry[], keyword: string): NoteEntry[] {
  const q = keyword.trim().toLowerCase();
  if (!q) return notes;
  return notes.filter(
    (note) =>
      note.inputText.toLowerCase().includes(q) || note.explanation.toLowerCase().includes(q)
  );
}
