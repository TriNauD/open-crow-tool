import type { SupabaseClient } from '@supabase/supabase-js';

export interface NoteEntry {
  id: string;
  user_id: string;
  inputText: string;
  explanation: string;
  parentId?: string;
  parentText?: string;
  source: 'web' | 'chrome_extension';
  savedAt: number;
  tags: string[];
}

interface DbRow {
  id: string;
  user_id: string;
  client_note_id: string | null;
  input_text: string;
  explanation: string;
  parent_id: string | null;
  parent_text: string | null;
  source: string;
  saved_at: string;
  tags: string[];
}

function rowToEntry(row: DbRow): NoteEntry {
  return {
    id: row.id,
    user_id: row.user_id,
    inputText: row.input_text,
    explanation: row.explanation,
    parentId: row.parent_id ?? undefined,
    parentText: row.parent_text ?? undefined,
    source: (row.source as NoteEntry['source']) ?? 'web',
    savedAt: new Date(row.saved_at).getTime(),
    tags: row.tags ?? [],
  };
}

export interface NoteDbContext {
  db: SupabaseClient;
  userId: string;
}

export interface SaveNoteInput {
  inputText: string;
  explanation: string;
  parentId?: string;
  parentText?: string;
  source?: NoteEntry['source'];
  clientNoteId?: string;
  tags?: string[];
}

export interface GuestMigrationEntry {
  clientNoteId: string;
  inputText: string;
  explanation: string;
  parentText?: string;
  source: NoteEntry['source'];
  savedAt: number;
  tags?: string[];
}

export async function getNotes(ctx: NoteDbContext): Promise<NoteEntry[]> {
  const { data, error } = await ctx.db
    .from('notes')
    .select('*')
    .eq('user_id', ctx.userId)
    .order('saved_at', { ascending: false });

  if (error) throw error;
  return (data as DbRow[]).map(rowToEntry);
}

export async function saveNote(
  ctx: NoteDbContext,
  entry: SaveNoteInput
): Promise<NoteEntry> {
  const { data, error } = await ctx.db
    .from('notes')
    .insert({
      user_id: ctx.userId,
      client_note_id: entry.clientNoteId ?? null,
      input_text: entry.inputText,
      explanation: entry.explanation,
      parent_id: entry.parentId ?? null,
      parent_text: entry.parentText ?? null,
      source: entry.source ?? 'web',
      tags: entry.tags ?? [],
    })
    .select()
    .single();

  if (error) throw error;
  return rowToEntry(data as DbRow);
}

export async function updateNoteTags(
  ctx: NoteDbContext,
  id: string,
  tags: string[]
): Promise<NoteEntry> {
  const { data, error } = await ctx.db
    .from('notes')
    .update({ tags })
    .eq('id', id)
    .eq('user_id', ctx.userId)
    .select()
    .single();

  if (error) throw error;
  return rowToEntry(data as DbRow);
}

export async function deleteNote(ctx: NoteDbContext, id: string): Promise<void> {
  const { error } = await ctx.db
    .from('notes')
    .delete()
    .eq('id', id)
    .eq('user_id', ctx.userId);

  if (error) throw error;
}

/** 把用户输入转成字面量 ilike 模式：反斜杠转义自身，% 与 _ 不再当通配符 */
function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export async function searchNotes(ctx: NoteDbContext, query: string): Promise<NoteEntry[]> {
  const pattern = `%${escapeIlikePattern(query.trim().toLowerCase())}%`;

  // 不用 PostgREST 的 or=()：关键词里的逗号/括号会破坏 or 语法导致 400，
  // 拆成两条 ilike 查询后在内存按 id 去重合并
  const [byInput, byExplanation] = await Promise.all([
    ctx.db
      .from('notes')
      .select('*')
      .eq('user_id', ctx.userId)
      .ilike('input_text', pattern)
      .order('saved_at', { ascending: false }),
    ctx.db
      .from('notes')
      .select('*')
      .eq('user_id', ctx.userId)
      .ilike('explanation', pattern)
      .order('saved_at', { ascending: false }),
  ]);

  if (byInput.error) throw byInput.error;
  if (byExplanation.error) throw byExplanation.error;

  const merged = new Map<string, DbRow>();
  for (const row of [...(byInput.data as DbRow[]), ...(byExplanation.data as DbRow[])]) {
    merged.set(row.id, row);
  }

  return [...merged.values()]
    .sort((a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime())
    .map(rowToEntry);
}

export async function migrateGuestNotes(
  ctx: NoteDbContext,
  entries: GuestMigrationEntry[]
): Promise<number> {
  if (entries.length === 0) {
    return 0;
  }

  // Fetch already-migrated client_note_ids to deduplicate before inserting.
  // This avoids relying on a partial unique index with upsert onConflict,
  // which Supabase JS cannot match against a WHERE-clause index.
  const clientNoteIds = entries.map((e) => e.clientNoteId);
  const { data: existing, error: selectError } = await ctx.db
    .from('notes')
    .select('client_note_id')
    .eq('user_id', ctx.userId)
    .in('client_note_id', clientNoteIds);

  if (selectError) throw selectError;

  const existingIds = new Set(
    (existing as Array<{ client_note_id: string | null }>).map((r) => r.client_note_id)
  );
  const newEntries = entries.filter((e) => !existingIds.has(e.clientNoteId));

  if (newEntries.length === 0) {
    return 0;
  }

  const rows = newEntries.map((entry) => ({
    user_id: ctx.userId,
    client_note_id: entry.clientNoteId,
    input_text: entry.inputText,
    explanation: entry.explanation,
    parent_id: null,
    parent_text: entry.parentText ?? null,
    source: entry.source ?? 'web',
    saved_at: new Date(entry.savedAt).toISOString(),
    tags: entry.tags ?? [],
  }));

  const { data, error } = await ctx.db
    .from('notes')
    .insert(rows)
    .select('id');

  if (error) throw error;
  return (data as Array<{ id: string }>).length;
}
