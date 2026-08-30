import { describe, expect, it } from 'vitest';
import {
  DISAMBIGUATION_RULES,
  SYSTEM_PROMPT,
  buildExplainPrompt,
  buildWeeklyDigestPrompt,
} from '@/lib/ai/prompts';

describe('DISAMBIGUATION_RULES / SYSTEM_PROMPT', () => {
  it('system 含消歧关键规则且含缩写/多义指引', () => {
    expect(SYSTEM_PROMPT).toContain(DISAMBIGUATION_RULES);
    expect(DISAMBIGUATION_RULES).toMatch(/全称|检索增强|一般指/);
    expect(DISAMBIGUATION_RULES).toMatch(/多义|语境|Transformer|科技/);
  });

  it('surrounding 提示仍强调消歧；周报 prompt 不被消歧规则污染', () => {
    const p = buildExplainPrompt('API', { surroundingText: '调用第三方 API' });
    expect(p).toContain('仅用于消歧');
    const weekly = buildWeeklyDigestPrompt({
      title: 'Foo',
      description: 'bar',
      url: 'https://example.com',
    });
    expect(weekly).not.toContain('名词与消歧');
  });
});
