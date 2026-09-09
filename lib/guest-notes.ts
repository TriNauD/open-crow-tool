export interface GuestNote {
  clientNoteId: string;
  inputText: string;
  explanation: string;
  parentText?: string;
  /**
   * 追问整树保存：父 note 的 id。
   * - 根卡：缺省
   * - 子卡：写入父卡的 clientNoteId（账号版用 `id`）
   * - 子卡「只存本条」：缺省（独立孤儿 note）
   */
  parentId?: string;
  source: 'web' | 'chrome_extension';
  savedAt: number;
  /** MVP：主分类在 tags[0]；旧数据可能无此字段 */
  tags?: string[];
}

const GUEST_NOTES_STORAGE_KEY = 'crow_guest_notes_v1';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** 读取并按 savedAt 倒序（最新在前） */
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

/** 写回 localStorage（按 savedAt 倒序） */
function persist(entries: GuestNote[]): void {
  if (!canUseStorage()) return;
  const sorted = [...entries].sort((a, b) => b.savedAt - a.savedAt);
  window.localStorage.setItem(GUEST_NOTES_STORAGE_KEY, JSON.stringify(sorted));
}

export function saveGuestNote(note: GuestNote) {
  const existing = getGuestNotes();
  persist([note, ...existing]);
}

/**
 * 批量写入（追问整树保存用）。
 * - 用一次原子 localStorage.setItem 写入整张新表；
 * - 已存在的同 clientNoteId 视为更新（保留 savedAt 不变）。
 */
export function saveGuestNotes(notes: GuestNote[]): void {
  if (notes.length === 0) return;
  const existing = getGuestNotes();
  const incomingById = new Map(notes.map((n) => [n.clientNoteId, n]));
  const next: GuestNote[] = [];
  // 先把未被覆盖的旧条目留下（保留它们的 savedAt）
  for (const e of existing) {
    const incoming = incomingById.get(e.clientNoteId);
    if (incoming) {
      // 已存在的：保留 savedAt 仅当 incoming 没有更新它（incoming 一般是当前时刻，已重新排序时会再次覆盖）
      next.push({ ...incoming, savedAt: incoming.savedAt || e.savedAt });
      incomingById.delete(e.clientNoteId);
    } else {
      next.push(e);
    }
  }
  // 剩余 incoming 是新条目（clientNoteId 在旧表里没出现过），直接加
  for (const n of incomingById.values()) next.push(n);
  persist(next);
}

/** 移除单条 */
export function removeGuestNote(clientNoteId: string) {
  persist(getGuestNotes().filter((note) => note.clientNoteId !== clientNoteId));
}

/** 批量移除（追问整树更新/级联删除用） */
export function removeGuestNotes(clientNoteIds: string[]): void {
  if (clientNoteIds.length === 0) return;
  const ids = new Set(clientNoteIds);
  persist(getGuestNotes().filter((note) => !ids.has(note.clientNoteId)));
}

export function updateGuestNoteTags(clientNoteId: string, tags: string[]) {
  persist(
    getGuestNotes().map((note) =>
      note.clientNoteId === clientNoteId ? { ...note, tags } : note
    )
  );
}

/** 批量更新 tags（追问整组 PATCH 用：父卡 tags 改动 → 子卡同步） */
export function updateGuestNotesTags(updates: Array<{ clientNoteId: string; tags: string[] }>): void {
  if (updates.length === 0) return;
  const byId = new Map(updates.map((u) => [u.clientNoteId, u.tags]));
  persist(
    getGuestNotes().map((note) => {
      const tags = byId.get(note.clientNoteId);
      return tags ? { ...note, tags } : note;
    })
  );
}

export function clearGuestNotes() {
  if (canUseStorage()) {
    window.localStorage.removeItem(GUEST_NOTES_STORAGE_KEY);
  }
}