'use server';

import { getNotes, saveNote, deleteNote, searchNotes, type NoteEntry } from '@/lib/storage';

export async function getNotesAction(): Promise<NoteEntry[]> {
  return getNotes();
}

export async function saveNoteAction(
  entry: Omit<NoteEntry, 'id' | 'savedAt' | 'user_id' | 'tags'>
): Promise<NoteEntry> {
  return saveNote(entry);
}

export async function deleteNoteAction(id: string): Promise<void> {
  return deleteNote(id);
}

export async function searchNotesAction(query: string): Promise<NoteEntry[]> {
  return searchNotes(query);
}
