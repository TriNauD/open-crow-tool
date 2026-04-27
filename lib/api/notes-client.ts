import type { NoteEntry } from '@/lib/db/notes';
import type { GuestNote } from '@/lib/guest-notes';

function authHeaders(accessToken: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const body = (await res.json()) as { data?: T; error?: string };
  if (!res.ok || !body.data) {
    throw new Error(body.error ?? 'Request failed');
  }
  return body.data;
}

export async function fetchNotes(accessToken: string, query?: string): Promise<NoteEntry[]> {
  const q = query?.trim();
  const url = q ? `/api/notes?q=${encodeURIComponent(q)}` : '/api/notes';
  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(accessToken),
  });
  return parseJsonOrThrow<NoteEntry[]>(res);
}

export async function createNote(
  accessToken: string,
  payload: {
    inputText: string;
    explanation: string;
    parentText?: string;
    source?: 'web' | 'chrome_extension';
    clientNoteId?: string;
  }
): Promise<NoteEntry> {
  const res = await fetch('/api/notes', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<NoteEntry>(res);
}

export async function deleteNoteById(accessToken: string, id: string): Promise<void> {
  const res = await fetch(`/api/notes/${id}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  await parseJsonOrThrow<{ id: string }>(res);
}

export async function replaceNote(
  accessToken: string,
  oldId: string,
  payload: {
    inputText: string;
    explanation: string;
    parentText?: string;
    source?: 'web' | 'chrome_extension';
  }
): Promise<NoteEntry> {
  await deleteNoteById(accessToken, oldId);
  return createNote(accessToken, payload);
}

export async function migrateGuestNotesToUser(
  accessToken: string,
  entries: GuestNote[]
): Promise<number> {
  const res = await fetch('/api/notes/migrate-guest', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ entries }),
  });
  const data = await parseJsonOrThrow<{ insertedCount: number }>(res);
  return data.insertedCount;
}
