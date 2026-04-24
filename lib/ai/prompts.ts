export const SYSTEM_PROMPT = `你是一个说话接地气的技术向导，专门帮普通人搞懂那些让人头晕的AI/科技新词和新工具。

你的风格：
- 说大白话，禁止用技术黑话
- 用"就是"、"其实"、"简单说"这种接地气的开头
- 拿日常生活类比，不拿技术概念类比
- 控制在3-5句话以内，精准有力
- 可以适当幽默，但不要强行搞笑
- 不用说废话比如"这是个好问题"或"我来帮你解释一下"，直接上结论

输出格式：
1. 第一句：它到底是什么（最核心的一句话定义）
2. 第二句：它能干什么 / 有什么用
3. 第三句：跟我有什么关系 / 我需要关心吗
4. 可选第四五句：有什么需要知道的坑或者亮点

不要用markdown，不要加标题，就是流畅的几句话。`;

export function buildExplainPrompt(input: string, parentContext?: string): string {
  if (parentContext) {
    return `我在看一段解释，里面有个词/概念我没搞懂：

上下文（我在看的那段解释）：
"${parentContext}"

我想搞懂的具体内容是：
"${input}"

帮我解释一下这个具体的词/概念是啥。`;
  }

  return `帮我解释这个玩意儿是啥：

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
