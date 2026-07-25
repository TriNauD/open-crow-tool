/** MVP：单主分类，落在 tags[0] */

export const MAX_TAG_LENGTH = 32;
export const MAX_TAGS_COUNT = 1;

export type TagsParseResult =
  | { ok: true; tags: string[] }
  | { ok: false; error: string };

/** 校验并规范化 API / 客户端传入的 tags（trim；空串丢弃；MVP 最多 1 个） */
export function parseTagsInput(raw: unknown): TagsParseResult {
  if (raw === undefined || raw === null) {
    return { ok: true, tags: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'tags must be an array of strings' };
  }
  if (raw.length > MAX_TAGS_COUNT) {
    return { ok: false, error: `tags supports at most ${MAX_TAGS_COUNT} categor${MAX_TAGS_COUNT === 1 ? 'y' : 'ies'}` };
  }

  const tags: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') {
      return { ok: false, error: 'tags must be an array of strings' };
    }
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (trimmed.length > MAX_TAG_LENGTH) {
      return { ok: false, error: `each tag must be at most ${MAX_TAG_LENGTH} characters` };
    }
    tags.push(trimmed);
  }

  return { ok: true, tags: tags.slice(0, MAX_TAGS_COUNT) };
}

/** 主分类名；无则 null（未分类） */
export function primaryCategory(tags: string[] | undefined | null): string | null {
  const name = tags?.[0]?.trim();
  return name ? name : null;
}

export type CategoryFilter = 'all' | 'uncategorized' | string;

export function matchesCategoryFilter(
  tags: string[] | undefined | null,
  filter: CategoryFilter
): boolean {
  if (filter === 'all') return true;
  const cat = primaryCategory(tags);
  if (filter === 'uncategorized') return cat === null;
  return cat === filter;
}

/** 从笔记列表收集已出现的主分类（去重，按首次出现顺序） */
export function collectCategories(notes: Array<{ tags?: string[] }>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const note of notes) {
    const cat = primaryCategory(note.tags);
    if (cat && !seen.has(cat)) {
      seen.add(cat);
      out.push(cat);
    }
  }
  return out;
}
