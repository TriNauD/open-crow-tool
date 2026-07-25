/** 选区前后纯文本截取（B-2）；失败返回空串，由调用方静默降级 */

export const SURROUNDING_MAX_SIDE = 120;

/**
 * 从 Range 取 common ancestor 内前后文，各最多 maxSide 字符；中间用【…】占位（不含选区正文重复）。
 */
export function extractSurroundingText(
  range: Range,
  maxSide: number = SURROUNDING_MAX_SIDE
): string {
  try {
    const container = range.commonAncestorContainer;
    const element =
      container.nodeType === Node.ELEMENT_NODE
        ? (container as Element)
        : container.parentElement;
    if (!element) return '';

    const beforeRange = range.ownerDocument?.createRange() ?? document.createRange();
    beforeRange.selectNodeContents(element);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    let before = beforeRange.toString().replace(/\s+/g, ' ').trimEnd();
    if (before.length > maxSide) before = before.slice(-maxSide);

    const afterRange = range.ownerDocument?.createRange() ?? document.createRange();
    afterRange.selectNodeContents(element);
    afterRange.setStart(range.endContainer, range.endOffset);
    let after = afterRange.toString().replace(/\s+/g, ' ').trimStart();
    if (after.length > maxSide) after = after.slice(0, maxSide);

    if (!before && !after) return '';
    return `${before}【…】${after}`;
  } catch {
    return '';
  }
}
