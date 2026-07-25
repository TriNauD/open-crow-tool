/** 缩写全称与多义消歧（C-1）；拼入 system，不改流式协议 */
export const DISAMBIGUATION_RULES = `名词与消歧（必须遵守）：
- 遇到缩写或专名：在大白话里尽量点出通行全称或领域锚点（例如 RAG → Retrieval-Augmented Generation / 检索增强生成）。吃不准时用「一般指…」，不要编造冷门全称。
- 一词多义：若用户消息里提供了「划词附近原文」或「父段解释」，按该语境选义项；若没有任何语境，默认按科技 / AI / 互联网产品语境解释，必要时用半句话点出也可能指别的东西（例如 Transformer 不是电力变压器）。
- 追问子词时：紧扣父段解释，不要跑题换义项。
- 仍然禁止 Markdown 与标题；仍然控制在 3～5 句。`;

const SYSTEM_PROMPT_BASE = `你是一个说话接地气的技术向导，专门帮普通人搞懂那些让人头晕的AI/科技新词和新工具。

你的风格：
- 说大白话，禁止用技术黑话
- 用"就是"、"其实"、"简单说"这种接地气的开头
- 控制在3-5句话以内，精准有力
- 幽默轻松，但不要强行搞笑
- 不用说废话比如"这是个好问题"或"我来帮你解释一下"，直接上结论
- 禁止说教口吻，不要居高临下地评价用户"需不需要关心"
- 禁止用老套的生活类比（减肥、做饭、考试等），用实际使用场景来解释
- 禁止性别刻板印象或任何群体刻板印象

输出格式：
1. 第一句：它到底是什么（最核心的一句话定义）
2. 第二句：它能干什么 / 实际怎么用
3. 第三句：在哪里会碰到它 / 谁在用它
4. 可选第四五句：有什么需要知道的坑或者亮点

不要用markdown，不要加标题，就是流畅的几句话。`;

export const SYSTEM_PROMPT = `${SYSTEM_PROMPT_BASE}

${DISAMBIGUATION_RULES}`;

export type ExplainPromptOptions = {
  /** Web 追问：父段解释 */
  parentContext?: string;
  /** 扩展划词：页面选区前后文（与 parentContext 语义不同） */
  surroundingText?: string;
};

function surroundingSection(surroundingText?: string): string {
  const s = surroundingText?.trim();
  if (!s) return '';
  return `以下是划词附近的原文片段，仅用于消歧；请以划词为主：\n"${s}"\n\n`;
}

export function buildExplainPrompt(
  input: string,
  parentContextOrOptions?: string | ExplainPromptOptions,
  maybeSurrounding?: string
): string {
  let parentContext: string | undefined;
  let surroundingText: string | undefined;

  if (typeof parentContextOrOptions === 'object' && parentContextOrOptions !== null) {
    parentContext = parentContextOrOptions.parentContext;
    surroundingText = parentContextOrOptions.surroundingText;
  } else {
    parentContext = parentContextOrOptions;
    surroundingText = maybeSurrounding;
  }

  const surrounding = surroundingSection(surroundingText);

  if (parentContext?.trim()) {
    return `${surrounding}我在看一段解释，里面有个词/概念我没搞懂：

上下文（我在看的那段解释）：
"${parentContext.trim()}"

我想搞懂的具体内容是：
"${input}"

帮我解释一下这个具体的词/概念是啥。`;
  }

  return `${surrounding}帮我解释这个玩意儿是啥：

${input}`;
}

export function buildWeeklyDigestPrompt(item: { title: string; description: string; url: string; stars?: number }): string {
  return `帮我用大白话解释这个最近火起来的工具/项目是啥，用户不懂技术：

名字：${item.title}
描述：${item.description}
${item.stars ? `GitHub Stars：${item.stars}` : ''}
链接：${item.url}

按要求输出3-5句话的大白话解释。`;
}
