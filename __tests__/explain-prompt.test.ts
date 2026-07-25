import { describe, expect, it } from 'vitest';
import { buildExplainPrompt } from '@/lib/ai/prompts';

describe('buildExplainPrompt', () => {
  it('无 surrounding / parent：仅选区', () => {
    const p = buildExplainPrompt('RAG');
    expect(p).toContain('RAG');
    expect(p).not.toContain('原文片段');
    expect(p).not.toContain('那段解释');
  });

  it('有 surroundingText：含消歧说明且兼容旧第二参字符串', () => {
    const withOpt = buildExplainPrompt('RAG', { surroundingText: '我们用 RAG 检索后再生成' });
    expect(withOpt).toContain('仅用于消歧');
    expect(withOpt).toContain('我们用 RAG 检索后再生成');
    expect(withOpt).toContain('RAG');

    const legacy = buildExplainPrompt('token', undefined, '上下文里的 token 预算');
    expect(legacy).toContain('token 预算');
  });

  it('parentContext 与 surrounding 可同时存在，顺序 surrounding 在前', () => {
    const p = buildExplainPrompt('embedding', {
      surroundingText: '页面前后文',
      parentContext: '父解释全文',
    });
    const iSurround = p.indexOf('页面前后文');
    const iParent = p.indexOf('父解释全文');
    expect(iSurround).toBeGreaterThanOrEqual(0);
    expect(iParent).toBeGreaterThan(iSurround);
    expect(p).toContain('embedding');
  });

  it('仅 parentContext（Web 追问）行为与旧版一致', () => {
    const p = buildExplainPrompt('向量', '这是父解释关于 RAG 的一段');
    expect(p).toContain('那段解释');
    expect(p).toContain('向量');
    expect(p).not.toContain('原文片段');
  });
});
