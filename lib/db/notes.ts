import { db } from './client';

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

function adminUserId(): string {
  const id = process.env.ADMIN_USER_ID;
  if (!id) throw new Error('Missing ADMIN_USER_ID env var');
  return id;
}

export async function getNotes(): Promise<NoteEntry[]> {
  const { data, error } = await db
    .from('notes')
    .select('*')
    .eq('user_id', adminUserId())
    .order('saved_at', { ascending: false });

  if (error) throw error;
  return (data as DbRow[]).map(rowToEntry);
}

export async function saveNote(
  entry: Omit<NoteEntry, 'id' | 'savedAt' | 'user_id' | 'tags'>
): Promise<NoteEntry> {
  const { data, error } = await db
    .from('notes')
    .insert({
      user_id: adminUserId(),
      input_text: entry.inputText,
      explanation: entry.explanation,
      parent_id: entry.parentId ?? null,
      parent_text: entry.parentText ?? null,
      source: entry.source ?? 'web',
    })
    .select()
    .single();

  if (error) throw error;
  return rowToEntry(data as DbRow);
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await db
    .from('notes')
    .delete()
    .eq('id', id)
    .eq('user_id', adminUserId());

  if (error) throw error;
}

export async function searchNotes(query: string): Promise<NoteEntry[]> {
  const q = query.toLowerCase();
  const { data, error } = await db
    .from('notes')
    .select('*')
    .eq('user_id', adminUserId())
    .or(`input_text.ilike.%${q}%,explanation.ilike.%${q}%`)
    .order('saved_at', { ascending: false });

  if (error) throw error;
  return (data as DbRow[]).map(rowToEntry);
}
