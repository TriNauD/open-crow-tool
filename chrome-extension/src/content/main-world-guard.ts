/**
 * 主世界（MAIN world）守卫：屏蔽宿主站点对「划词浮标」调用 `scrollIntoView`。
 *
 * ## 它治的是什么
 *
 * 浮标为了根治滚动晃动，`position:absolute` 挂进了**选区所在的滚动容器**
 * （见 `floating-anchor.ts`）。代价是浮标成了容器里一个「真实存在、位置就在
 * 选区处」的元素——于是会被站点自己的滚动启发式选中：
 *
 * 真机实录（`gemini.google.com/app`，划词后探针抓到的站点侧调用栈）：
 * ```
 * [call scrollIntoView] BUTTON.crow-btn [{"block":"start","inline":"nearest",...}]
 *    at c (https://gemini.gstatic.com/.../boq-bard-web...)
 *    at qoi.Da (https://gemini.gstatic.com/.../boq-bard-web...)
 * ```
 * 每次划词松手，Gemini 都会挑中我们的浮标并 `scrollIntoView({block:'start'})`，
 * 于是消息区**平滑滚到被划的词贴顶** = 用户报的「划词后页面自己乱滚」。
 *
 * ## 为什么必须跑在主世界
 *
 * content script 默认跑在 isolated world。在隔离世界给 DOM 节点 `defineProperty`
 * 加的 expando 属性，**主世界看不见**（真机验证：主世界读到的仍是 prototype 上的
 * 原生 `scrollIntoView`），所以「在组件里给浮标覆盖一份 no-op」这条路无效。
 * 唯一可靠做法是让守卫和站点代码同处主世界——由 manifest 用
 * `"world": "MAIN"` 声明本脚本。
 *
 * ## 边界（重要）
 *
 * - 只拦「目标是浮标自己」的调用：判据是亮 DOM 标记 `data-crow-fab`
 *   （`FloatingButton` 渲染时必带），其它元素的调用原样透传给原生实现。
 * - 占位极薄：一次 `closest()` 属性查找，`scrollIntoView` 本身是站点侧的
 *   低频调用（用户划词 / 跳转），不在热路径上。
 * - 幂等 + 绝不影响插件之外的宿主功能；注册在 `document_start`，
 *   保证用户第一次划词之前守卫就已到位（不能等到浮标挂载再装，那时已晚）。
 */

/** 亮 DOM 浮标标记：`FloatingButton` 渲染的 `button.crow-btn[data-crow-fab="1"]` */
const FAB_SELECTOR = '[data-crow-fab]';

/** 幂等标记挂在 window 上（主世界被多次注入时不重复包） */
const INSTALLED_FLAG = '__crowFabScrollGuardInstalled';

function isCrowFab(node: unknown): boolean {
  return node instanceof Element && node.closest(FAB_SELECTOR) !== null;
}

function installFabScrollGuard(): void {
  const w = window as Window & Record<string, unknown>;
  if (w[INSTALLED_FLAG] === true) return;
  w[INSTALLED_FLAG] = true;

  const proto = Element.prototype as Element & {
    scrollIntoViewIfNeeded?: (centerIfNeeded?: boolean) => void;
  };

  const nativeScrollIntoView = proto.scrollIntoView;
  proto.scrollIntoView = function scrollIntoView(
    this: Element,
    ...args: Parameters<Element['scrollIntoView']>
  ): void {
    try {
      // 只吞「滚到浮标」这一类：浮标贴词是它的全部职责，从不应成为滚动的理由。
      // 反过来说，站点想滚到自己的元素时一律透传，行为与本扩展不存在时一致。
      if (isCrowFab(this)) return;
    } catch {
      /* 判据异常就当不是浮标，透传，绝不因守卫自身出错改变站点行为 */
    }
    return nativeScrollIntoView.apply(this, args);
  } as typeof proto.scrollIntoView;

  // Chrome 非标准 API，部分站点会用
  const nativeScrollIntoViewIfNeeded = proto.scrollIntoViewIfNeeded;
  if (typeof nativeScrollIntoViewIfNeeded === 'function') {
    proto.scrollIntoViewIfNeeded = function scrollIntoViewIfNeeded(
      this: Element,
      ...args: unknown[]
    ): void {
      try {
        if (isCrowFab(this)) return;
      } catch {
        /* 同上 */
      }
      return nativeScrollIntoViewIfNeeded.apply(this, args);
    };
  }
}

installFabScrollGuard();
