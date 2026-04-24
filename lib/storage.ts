export interface NoteEntry {
  id: string;
  inputText: string;
  explanation: string;
  parentId?: string;       // for recursive entries
  parentText?: string;     // the parent context text
  savedAt: number;
  tags?: string[];
}

const STORAGE_KEY = 'wtf_notebook';

export function getNotes(): NoteEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveNote(entry: Omit<NoteEntry, 'id' | 'savedAt'>): NoteEntry {
  const notes = getNotes();
  const newEntry: NoteEntry = {
    ...entry,
    id: crypto.randomUUID(),
    savedAt: Date.now(),
  };
  notes.unshift(newEntry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  return newEntry;
}

export function deleteNote(id: string): void {
  const notes = getNotes().filter((n) => n.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function searchNotes(query: string): NoteEntry[] {
  const q = query.toLowerCase();
  return getNotes().filter(
    (n) =>
      n.inputText.toLowerCase().includes(q) ||
      n.explanation.toLowerCase().includes(q)
  );
}
