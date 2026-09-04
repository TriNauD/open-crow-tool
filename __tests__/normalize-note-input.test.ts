import { describe, expect, it } from 'vitest';
import { normalizeNoteInput } from '@/lib/notes/normalize-input';

describe('normalizeNoteInput', () => {
  it('折叠空白与大小写', () => {
    expect(normalizeNoteInput('RAG 是啥')).toBe(normalizeNoteInput('rag是啥'));
    expect(normalizeNoteInput('  Foo   Bar ')).toBe('foobar');
  });
});
