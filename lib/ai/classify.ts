import { getProviderChain, parseUserLLMConfig, USER_LLM_CONFIG_HEADER } from './providers';
import { MAX_TAG_LENGTH } from '@/lib/notes/tags';

/**
 * 总结分类器（tag 生成）：
 * 把用户「被解释的词/问题」+ 对应「大白话解释」归总成一个中文主题短词，
 * 例如划了 TCP → 「计算机网络」。复用语站的 provider 链，调用极轻量
 * （max_tokens 很小、temperature 0），成本可忽略。
 */

const CLASSIFY_SYSTEM = `你是一个内容分类器。用户会给你一个"被解释的词/问题"以及对应的"大白话解释"。
请输出【一个】最贴切的中文主题分类，要求：
- 2~6 个汉字，从一个通用领域里归总。可参考的领域示例：
  计算机网络、操作系统、编程语言、前端开发、后端开发、数据库、AI大模型、机器学习、
  网络安全、区块链、云计算、硬件、移动开发、产品设计、自动化工具、办公软件、创业/商业、科普/其他。
- 如果用户问的具体术语明显属于上述某类，就直接用该类名；跨类或拿不准时，用最贴近的一个，
  必要时可自创一个不超过 6 字的中文短词（如「天文」「医学」「金融」）。
- 只输出分类词本身，不要引号、不要标点、不要序号、不要解释，不要换行。`;

export interface ClassifyInput {
  inputText: string;
  explanation?: string;
  /** 透传用户自配 LLM 头（x-crow-llm-config）；空则走服务器默认 provider 链 */
  userLlmConfigHeader?: string | null;
}

/** 清洗模型输出：去引号/标点/序号/空白，截断至 MAX_TAG_LENGTH，只留中英文数字 */
function normalizeTag(raw: string): string {
  const stripped = raw
    .replace(/^["'「『（(【]\s*|\s*["'」』)）】]\s*$/g, '')
    .replace(/^[\d]+[.、)）]\s*/, '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  if (!stripped) return '';
  // 只保留字母、数字、汉字与（极少出现的）空格，其余标点丢弃
  const onlyText = stripped.replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, '');
  return onlyText.slice(0, MAX_TAG_LENGTH);
}

/** 生成单条笔记的总结 tag；失败返回 null（调用方退化为「未分类」） */
export async function classifyCategory(input: ClassifyInput): Promise<string | null> {
  const inputText = input.inputText?.trim();
  if (!inputText) return null;

  const userCfg = parseUserLLMConfig(input.userLlmConfigHeader ?? null);
  const chain = getProviderChain(userCfg, { hasImage: false, budgetOk: true });
  if (chain.length === 0) return null;

  const explanation = (input.explanation ?? '').trim().slice(0, 2000);
  const userContent = `被解释的内容：${inputText}\n${
    explanation ? `对应的解释：${explanation}\n` : ''
  }\n请输出主题分类：`;

  for (const { client, model } of chain) {
    try {
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: CLASSIFY_SYSTEM },
          { role: 'user', content: userContent },
        ],
        max_tokens: 16,
        temperature: 0,
        stream: false,
      });
      const raw = res.choices?.[0]?.message?.content ?? '';
      const tag = normalizeTag(raw);
      if (tag) return tag;
    } catch (err) {
      console.warn('[classify] provider failed, trying next', err);
    }
  }
  return null;
}

export { USER_LLM_CONFIG_HEADER };
