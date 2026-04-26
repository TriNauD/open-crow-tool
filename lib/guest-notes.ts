export interface GuestNote {
  clientNoteId: string;
  inputText: string;
  explanation: string;
  parentText?: string;
  source: 'web' | 'chrome_extension';
  savedAt: number;
}

const GUEST_NOTES_STORAGE_KEY = 'wtf_guest_notes_v1';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getGuestNotes(): GuestNote[] {
  if (!canUseStorage()) return [];

  const raw = window.localStorage.getItem(GUEST_NOTES_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as GuestNote[];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.savedAt - a.savedAt) : [];
  } catch {
    return [];
  }
}

export function saveGuestNote(note: GuestNote) {
  const existing = getGuestNotes();
  const next = [note, ...existing];
  if (canUseStorage()) {
    window.localStorage.setItem(GUEST_NOTES_STORAGE_KEY, JSON.stringify(next));
  }
}

export function removeGuestNote(clientNoteId: string) {
  const next = getGuestNotes().filter((note) => note.clientNoteId !== clientNoteId);
  if (canUseStorage()) {
    window.localStorage.setItem(GUEST_NOTES_STORAGE_KEY, JSON.stringify(next));
  }
}

export function clearGuestNotes() {
  if (canUseStorage()) {
    window.localStorage.removeItem(GUEST_NOTES_STORAGE_KEY);
  }
}
