import { describe, expect, it } from 'vitest';
import { filterNotesByKeyword } from '@/lib/notes-search';
import { searchNotes, type NoteDbContext, type NoteEntry } from '@/lib/db/notes';

function makeNote(overrides: Partial<NoteEntry> = {}): NoteEntry {
  return {
    id: 'n1',
    user_id: 'u1',
    inputText: '什么是 RAG',
    explanation: '检索增强生成，先查资料再回答',
    source: 'web',
    savedAt: 1_000,
    tags: [],
    ...overrides,
  };
}

describe('filterNotesByKeyword（笔记本本地过滤）', () => {
  const notes = [
    makeNote({ id: '1', inputText: 'RAG 是什么', explanation: '检索增强' }),
    makeNote({ id: '2', inputText: 'MCP 协议', explanation: 'Model Context Protocol' }),
    makeNote({ id: '3', inputText: '随便记的', explanation: '提到过 rag 的解释' }),
  ];

  it('空关键词返回全部', () => {
    expect(filterNotesByKeyword(notes, '')).toHaveLength(3);
    expect(filterNotesByKeyword(notes, '   ')).toHaveLength(3);
  });

  it('大小写不敏感，命中输入或解释任一字段', () => {
    expect(filterNotesByKeyword(notes, 'rag').map((n) => n.id)).toEqual(['1', '3']);
    expect(filterNotesByKeyword(notes, 'MCP').map((n) => n.id)).toEqual(['2']);
    expect(filterNotesByKeyword(notes, 'protocol').map((n) => n.id)).toEqual(['2']);
  });

  it('逗号、%、括号等特殊字符按字面匹配，不报错', () => {
    const special = [makeNote({ id: 'x', inputText: '函数 f(a,b) 用法', explanation: '含 100% 成功率' })];
    expect(filterNotesByKeyword(special, 'f(a,b)')).toHaveLength(1);
    expect(filterNotesByKeyword(special, '100%')).toHaveLength(1);
    expect(filterNotesByKeyword(special, ',')).toHaveLength(1);
    expect(filterNotesByKeyword(notes, ',')).toHaveLength(0);
  });
});

/** Supabase 查询构建器的最小 fake：链式调用，order() 处 await 出结果 */
function makeFakeDb(results: Array<{ data: unknown; error: unknown }>) {
  const ilikeCalls: Array<{ column: string; pattern: string }> = [];
  let resultIndex = 0;

  const builder = () => {
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      ilike: (column: string, pattern: string) => {
        ilikeCalls.push({ column, pattern });
        return chain;
      },
      order: () => Promise.resolve(results[resultIndex++] ?? { data: [], error: null }),
    };
    return chain;
  };

  return {
    db: { from: () => builder() } as unknown as NoteDbContext['db'],
    ilikeCalls,
  };
}

describe('searchNotes（后端去重候选查询，特殊字符安全）', () => {
  const ctxBase = { userId: 'u1' };

  it('关键词含 % _ 时按字面转义，两条 ilike 合并去重并按时间倒序', async () => {
    const rows = (id: string, savedAt: string) => ({
      id,
      user_id: 'u1',
      input_text: `input-${id}`,
      explanation: 'e',
      parent_id: null,
      parent_text: null,
      source: 'web',
      saved_at: savedAt,
      tags: [],
    });
    // 第一条查询命中 2 行，第二条查询命中其中 1 行（重复，应去重）
    const { db, ilikeCalls } = makeFakeDb([
      { data: [rows('a', '2026-01-02T00:00:00Z'), rows('b', '2026-01-01T00:00:00Z')], error: null },
      { data: [rows('a', '2026-01-02T00:00:00Z')], error: null },
    ]);

    const notes = await searchNotes({ db, userId: ctxBase.userId }, '100%_off');

    expect(ilikeCalls).toHaveLength(2);
    expect(ilikeCalls.every((c) => c.pattern === '%100\\%\\_off%')).toBe(true);
    expect(notes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(notes.map((n) => n.inputText)).toEqual(['input-a', 'input-b']);
  });

  it('查询失败时抛错', async () => {
    const { db } = makeFakeDb([
      { data: null, error: { message: 'db down' } },
      { data: [], error: null },
    ]);
    await expect(searchNotes({ db, userId: 'u1' }, 'x')).rejects.toBeTruthy();
  });

  it('trim 后的空查询仍会执行两条 ilike（调用方负责空值短路）', async () => {
    const { db, ilikeCalls } = makeFakeDb([
      { data: [], error: null },
      { data: [], error: null },
    ]);
    await searchNotes({ db, userId: 'u1' }, '   ');
    expect(ilikeCalls).toHaveLength(2);
    expect(ilikeCalls[0].pattern).toBe('%%');
  });
});
