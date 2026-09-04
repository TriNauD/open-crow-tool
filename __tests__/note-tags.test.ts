import { describe, expect, it } from 'vitest';
import {
  collectCategories,
  matchesCategoryFilter,
  MAX_TAG_LENGTH,
  parseTagsInput,
  primaryCategory,
} from '@/lib/notes/tags';

describe('parseTagsInput', () => {
  it('缺省 / null → 空数组', () => {
    expect(parseTagsInput(undefined)).toEqual({ ok: true, tags: [] });
    expect(parseTagsInput(null)).toEqual({ ok: true, tags: [] });
  });

  it('trim 并丢弃空串', () => {
    expect(parseTagsInput(['  RAG  '])).toEqual({ ok: true, tags: ['RAG'] });
    expect(parseTagsInput(['   '])).toEqual({ ok: true, tags: [] });
  });

  it('拒绝非数组、过长、多于 1 个', () => {
    expect(parseTagsInput('RAG').ok).toBe(false);
    expect(parseTagsInput(['a', 'b']).ok).toBe(false);
    expect(parseTagsInput(['x'.repeat(MAX_TAG_LENGTH + 1)]).ok).toBe(false);
  });
});

describe('category helpers', () => {
  it('primaryCategory / filter / collect', () => {
    expect(primaryCategory([])).toBeNull();
    expect(primaryCategory(['工具'])).toBe('工具');
    expect(matchesCategoryFilter([], 'uncategorized')).toBe(true);
    expect(matchesCategoryFilter(['工具'], '工具')).toBe(true);
    expect(matchesCategoryFilter(['工具'], 'all')).toBe(true);
    expect(
      collectCategories([{ tags: ['A'] }, { tags: [] }, { tags: ['A'] }, { tags: ['B'] }])
    ).toEqual(['A', 'B']);
  });
});
