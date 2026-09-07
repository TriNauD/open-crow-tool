import { useEffect, useRef, useState, useCallback } from 'react';
import type { CrowAuth } from '../lib/crow-session';
import { ensureFreshAuth, loadCrowAuth } from '../lib/crow-session';
import { useStreamExplain } from './useStreamExplain';
import { normalizeNoteInput } from './normalize-note-input';
import CrowLoginForm from '../components/CrowLoginForm';

/** 一轮历史：问题 + 当时的回答 */
interface FollowUpTurn {
  question: string;
  explanation: string;
}

interface Props {
  text: string;
  surroundingText?: string;
  anchorX: number;
  anchorY: number;
  config: CrowAuth;
  isAuthenticated?: boolean;
  onConnectPlugin?: () => void;
  onSessionUpdate?: (next: CrowAuth) => void;
  onClose: () => void;
  context?: string;
  history?: FollowUpTurn[];
  depth?: number;
}

type DuplicateHit = {
  id: string;
  inputText: string;
  explanation: string;
};

const CARD_W = 360;
const CARD_H = 320;
const CARD_MARGIN = 12;

export default function ExplainCard({
  text,
  surroundingText,
  anchorX,
  anchorY,
  config,
  isAuthenticated = true,
  onConnectPlugin,
  onSessionUpdate,
  onClose,
  context,
  history,
  depth = 0,
}: Props) {
  // ── 基础状态 ──
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<'generic' | 'expired' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateHit | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpText, setFollowUpText] = useState('');
  const [children, setChildren] = useState<{ id: string; text: string }[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { text: explanation, isLoading, error, isDone, explain, quotaOut, tag } = useStreamExplain(
    config.apiBaseUrl
  );

  // ── 钉住 / 拖拽状态 ──
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = anchorX - CARD_W / 2;
    x = Math.max(CARD_MARGIN, Math.min(x, vw - CARD_W - CARD_MARGIN));
    let y = anchorY - CARD_H - 10;
    if (y < CARD_MARGIN) y = anchorY + 24;
    y = Math.max(CARD_MARGIN, Math.min(y, vh - CARD_H - CARD_MARGIN));
    return { x, y };
  });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // ── 折叠状态：仅手动切换（出子卡片不自动收起，改为自动滚动到最新回答） ──
  const [collapsed, setCollapsed] = useState(false);

  // ── 出子卡片后自动跟随滚动到底部；用户向上滚动即停止跟随 ──
  const followBottomRef = useRef(false);
  const childNodesRef = useRef(new Map<string, HTMLDivElement>());

  // ── 滚动箭头状态 ──
  const [canScroll, setCanScroll] = useState(false);
  const [scrollAtTop, setScrollAtTop] = useState(true);
  const [scrollAtBottom, setScrollAtBottom] = useState(false);

  const notebookUrl = `${config.apiBaseUrl.replace(/\/+$/, '')}/notebook`;

  // ── 对话记录组装 ──
  const transcriptContext = history?.length
    ? history
        .map(
          (t, i) =>
            `第 ${i + 1} 轮问答：\n问：「${t.question}」\n答：「${t.explanation}」`
        )
        .join('\n\n')
    : undefined;

  const hasExplainReady = Boolean(explanation?.length) && isDone && !error;
  const showSaveFooter =
    hasExplainReady || Boolean(saveError) || isSaving || Boolean(duplicate);

  // ═══════════════════════════════════════════
  //  效果：发起解释
  // ═══════════════════════════════════════════
  useEffect(() => {
    if (transcriptContext) {
      explain(text, { context: transcriptContext });
    } else if (surroundingText) {
      explain(text, { surroundingText });
    } else {
      explain(text);
    }
  }, [text, transcriptContext, surroundingText, explain]);

  // ═══════════════════════════════════════════
  //  效果：点击外部关闭（钉住时不关闭）
  // ═══════════════════════════════════════════
  useEffect(() => {
    if (pinned) return;
    function onMouseDown(e: MouseEvent) {
      const path = e.composedPath();
      if (cardRef.current && !path.includes(cardRef.current)) {
        onClose();
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', onMouseDown);
    }, 150);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [onClose, pinned]);

  // ═══════════════════════════════════════════
  //  效果：检测 body 是否可滚动 + 滚动位置
  // ═══════════════════════════════════════════
  const checkScroll = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const overflow = el.scrollHeight > el.clientHeight + 2;
    setCanScroll(overflow);
    setScrollAtTop(el.scrollTop <= 2);
    setScrollAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    el.addEventListener('scroll', checkScroll, { passive: true });
    // 向上滚 = 用户想停在上面，关掉底部跟随
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) followBottomRef.current = false;
    };
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', checkScroll);
      el.removeEventListener('wheel', onWheel);
    };
  }, [checkScroll, explanation, children.length]);

  // ═══════════════════════════════════════════
  //  拖拽逻辑
  // ═══════════════════════════════════════════
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (!pinned) return;
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };

      function onMove(ev: MouseEvent) {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        const dy = ev.clientY - dragRef.current.startY;
        const newX = Math.max(CARD_MARGIN, Math.min(dragRef.current.origX + dx, window.innerWidth - CARD_W - CARD_MARGIN));
        const newY = Math.max(CARD_MARGIN, Math.min(dragRef.current.origY + dy, window.innerHeight - 60));
        setPos({ x: newX, y: newY });
      }

      function onUp() {
        dragRef.current = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    },
    [pinned, pos]
  );

  // ═══════════════════════════════════════════
  //  滚动到顶部 / 底部
  // ═══════════════════════════════════════════
  const scrollToTop = useCallback(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToBottom = useCallback(() => {
    followBottomRef.current = true;
    const el = bodyRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  // ═══════════════════════════════════════════
  //  保存相关逻辑（不变）
  // ═══════════════════════════════════════════
  async function resolveAuth(): Promise<{ token: string; baseUrl: string } | null> {
    const preHint = await loadCrowAuth();
    const auth = await ensureFreshAuth(preHint, { force: true });
    if (!auth?.accessToken) {
      setSaveError('expired');
      return null;
    }
    onSessionUpdate?.(auth);
    const baseUrl = (auth.apiBaseUrl || config.apiBaseUrl).replace(/\/+$/, '');
    return { token: auth.accessToken, baseUrl };
  }

  async function findDuplicate(baseUrl: string, token: string): Promise<DuplicateHit | null> {
    const q = encodeURIComponent(text.trim());
    const res = await fetch(`${baseUrl}/api/notes?q=${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: Array<{ id: string; inputText: string; explanation: string; parentText?: string }>;
    };
    const needle = normalizeNoteInput(text);
    const hit = (body.data ?? []).find(
      (n) => normalizeNoteInput(n.inputText) === needle && !n.parentText
    );
    return hit ? { id: hit.id, inputText: hit.inputText, explanation: hit.explanation } : null;
  }

  async function postNote(baseUrl: string, token: string, tags?: string[]): Promise<Response> {
    return fetch(`${baseUrl}/api/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ inputText: text, explanation, source: 'chrome_extension', tags: tags ?? [] }),
    });
  }

  async function deleteNote(baseUrl: string, token: string, id: string): Promise<boolean> {
    const res = await fetch(`${baseUrl}/api/notes/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  }

  async function saveWithToken(
    baseUrl: string,
    token: string,
    mode: 'create' | 'replace',
    oldId?: string
  ): Promise<boolean> {
    let workingToken = token;
    if (mode === 'replace' && oldId) {
      const deleted = await deleteNote(baseUrl, workingToken, oldId);
      if (!deleted) {
        const after = await ensureFreshAuth(await loadCrowAuth(), { force: true });
        if (!after?.accessToken) { setSaveError('expired'); return false; }
        onSessionUpdate?.(after);
        workingToken = after.accessToken;
        if (!(await deleteNote(baseUrl, workingToken, oldId))) { setSaveError('generic'); return false; }
      }
    }
    // tag 由 useStreamExplain 在解释完成时自动生成；保存时自动带上（退化时为空数组 = 未分类）
    const tags = tag ? [tag] : [];
    let res = await postNote(baseUrl, workingToken, tags);
    if (res.status === 401 || res.status === 403) {
      const after = await ensureFreshAuth(await loadCrowAuth(), { force: true });
      if (!after?.accessToken) { setSaveError('expired'); return false; }
      onSessionUpdate?.(after);
      res = await postNote(baseUrl, after.accessToken, tags);
    }
    if (res.ok) {
      const data = await res.json();
      setSavedId(data.data?.id ?? 'saved');
      setDuplicate(null);
      return true;
    }
    setSaveError(res.status === 401 || res.status === 403 ? 'expired' : 'generic');
    return false;
  }

  async function handleSave() {
    setSaveError(null);
    setIsSaving(true);
    try {
      const auth = await resolveAuth();
      if (!auth) return;
      const hit = await findDuplicate(auth.baseUrl, auth.token);
      if (hit) { setDuplicate(hit); return; }
      await saveWithToken(auth.baseUrl, auth.token, 'create');
    } catch { setSaveError('generic'); } finally { setIsSaving(false); }
  }

  async function handleKeepBoth() {
    setSaveError(null);
    setIsSaving(true);
    try {
      const auth = await resolveAuth();
      if (!auth) return;
      await saveWithToken(auth.baseUrl, auth.token, 'create');
    } catch { setSaveError('generic'); } finally { setIsSaving(false); }
  }

  async function handleReplace() {
    if (!duplicate) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      const auth = await resolveAuth();
      if (!auth) return;
      await saveWithToken(auth.baseUrl, auth.token, 'replace', duplicate.id);
    } catch { setSaveError('generic'); } finally { setIsSaving(false); }
  }

  async function handleLoginSuccess(auth: CrowAuth) {
    setLoginOpen(false);
    setSaveError(null);
    onSessionUpdate?.(auth);
    if (duplicate) await handleReplace();
    else await handleSave();
  }

  const handleFollowUpSubmit = useCallback(() => {
    const q = followUpText.trim();
    if (!q) return;
    followBottomRef.current = true;
    setChildren((prev) => [...prev, { id: crypto.randomUUID(), text: q }]);
    setFollowUpText('');
    setFollowUpOpen(false);
  }, [followUpText]);

  // ═══════════════════════════════════════════
  //  效果：子卡片出现/流式增长时跟随滚动到底部
  //  （子卡片无高度上限，增长撑大父卡片 body 的滚动区，
  //   ResizeObserver 挂在子卡片包裹层上才能感知内容变化）
  // ═══════════════════════════════════════════
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || children.length === 0) return;
    const follow = () => {
      if (followBottomRef.current) el.scrollTop = el.scrollHeight;
    };
    follow();
    const ro = new ResizeObserver(follow);
    childNodesRef.current.forEach((node) => node && ro.observe(node));
    return () => ro.disconnect();
  }, [children]);

  // ═══════════════════════════════════════════
  //  渲染
  // ═══════════════════════════════════════════
  const cardClassName = `crow-card${pinned ? ' pinned' : ''}${collapsed ? ' collapsed' : ''}`;

  return (
    <div
      ref={cardRef}
      className={cardClassName}
      style={pinned ? { left: pos.x, top: pos.y } : { left: pos.x, top: pos.y }}
    >
      {/* ── 顶部拖拽把手 + 标题 ── */}
      <div
        className={`crow-card-header${pinned ? ' crow-draggable' : ''}`}
        onMouseDown={handleDragStart}
      >
        {pinned && <span className="crow-drag-handle" title="拖拽移动">⠿</span>}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="crow-card-label">
            这是啥？
            {/* 主卡有子卡时、以及所有子卡片：都可折叠自身内容 */}
            {(depth > 0 || children.length > 0) && (
              <button
                className="crow-collapse-badge"
                onClick={(e) => { e.stopPropagation(); setCollapsed((v) => !v); }}
                title={collapsed ? '展开内容' : '折叠内容'}
              >
                {collapsed ? '▶' : '▼'}
                {children.length > 0 ? ` ${children.length} 条追问` : ''}
              </button>
            )}
          </div>
          <div className="crow-card-query">
            {text.length > 80 ? text.slice(0, 80) + '…' : text}
          </div>
        </div>
        <div className="crow-header-actions">
          {/* 图钉只对主卡有意义：子卡片内嵌在父卡 body 里，钉住/拖拽均无效 */}
          {depth === 0 && (
            <button
              className={`crow-pin-btn${pinned ? ' active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setPinned((v) => !v); }}
              title={pinned ? '取消钉住' : '钉住卡片'}
              type="button"
            >
              {pinned ? '📍' : '📌'}
            </button>
          )}
          <button className="crow-close" onClick={onClose} title="关闭 (Esc)">
            ×
          </button>
        </div>
      </div>

      {/* ── 可滚动内容区 ── */}
      <div ref={bodyRef} className={`crow-card-body${collapsed ? ' collapsed' : ''}`}>
        {!collapsed && (
          <>
            {isLoading && !explanation && (
              <div className="crow-loading">
                <span className="crow-dot" />
                <span className="crow-dot" />
                <span className="crow-dot" />
                <span style={{ marginLeft: 8 }}>正在思考中...</span>
              </div>
            )}
            {error && <div className="crow-error">{error}</div>}
            {loginOpen && (
              <div style={{ marginTop: explanation ? 10 : 0 }}>
                <CrowLoginForm
                  variant="card"
                  onSuccess={(auth) => void handleLoginSuccess(auth)}
                  onCancel={() => setLoginOpen(false)}
                />
                {onConnectPlugin && (
                  <p style={{ fontSize: 11, color: '#52525b', margin: '8px 0 0' }}>
                    无法登录？
                    <button
                      type="button"
                      onClick={onConnectPlugin}
                      style={{
                        background: 'none', border: 'none', color: '#fb923c',
                        cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: 11,
                      }}
                    >
                      打开扩展设置
                    </button>
                  </p>
                )}
              </div>
            )}
            {explanation && !duplicate && (
              <span>
                {explanation}
                {isLoading && <span className="crow-cursor" />}
              </span>
            )}
            {duplicate && (
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                <p style={{ color: '#fb923c', margin: '0 0 8px' }}>已有同名笔记，请选择：</p>
                <p style={{ color: '#a1a1aa', margin: '0 0 4px' }}>旧答案（截断）：</p>
                <p style={{ color: '#d4d4d8', margin: '0 0 8px' }}>
                  {duplicate.explanation.length > 160
                    ? duplicate.explanation.slice(0, 160) + '…'
                    : duplicate.explanation}
                </p>
                <p style={{ color: '#a1a1aa', margin: '0 0 4px' }}>新答案（截断）：</p>
                <p style={{ color: '#fafafa', margin: 0 }}>
                  {(explanation ?? '').length > 160
                    ? (explanation ?? '').slice(0, 160) + '…'
                    : explanation}
                </p>
              </div>
            )}
          </>
        )}

        {/* 递归子卡片 */}
        {children.map((child) => (
          <div
            key={child.id}
            className="crow-child-card"
            ref={(node) => {
              if (node) childNodesRef.current.set(child.id, node);
              else childNodesRef.current.delete(child.id);
            }}
          >
            <ExplainCard
              text={child.text}
              surroundingText={explanation}
              anchorX={0}
              anchorY={0}
              config={config}
              isAuthenticated={isAuthenticated}
              onConnectPlugin={onConnectPlugin}
              onSessionUpdate={onSessionUpdate}
              onClose={() => {}}
              context={explanation}
              history={[
                ...(history ?? []),
                { question: text, explanation: explanation ?? '' },
              ]}
              depth={depth + 1}
            />
          </div>
        ))}
      </div>

      {/* ── 滚动箭头 ── */}
      {canScroll && !collapsed && (
        <div className="crow-scroll-arrows">
          <button
            className="crow-scroll-arrow"
            onClick={scrollToTop}
            disabled={scrollAtTop}
            title="回到顶部"
            type="button"
          >
            ↑
          </button>
          <button
            className="crow-scroll-arrow"
            onClick={scrollToBottom}
            disabled={scrollAtBottom}
            title="滚到底部"
            type="button"
          >
            ↓
          </button>
        </div>
      )}

      {quotaOut && isDone && (
        <div className="crow-hint" style={{ fontSize: 11 }}>
          今日免费额度已用完，本次使用免费模型
        </div>
      )}

      {/* ── 底部操作栏 ── */}
      {showSaveFooter && (
        <div className="crow-card-footer">
          {!isAuthenticated ? (
            loginOpen ? (
              <span className="crow-hint" style={{ fontSize: 12 }}>
                登录后即可存入笔记本
              </span>
            ) : (
              <button
                className="crow-save-btn"
                onClick={() => setLoginOpen(true)}
                type="button"
                title="在本卡片内登录，登录后自动继续保存"
              >
                登录后可保存
              </button>
            )
          ) : savedId ? (
            <button className="crow-save-btn saved" disabled>
              ✓ 已存入笔记本
            </button>
          ) : saveError === 'expired' ? (
            <span className="crow-error" style={{ fontSize: 12 }}>
              ⚠️ 登录或连接已过期，
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                style={{
                  background: 'none', border: 'none', color: '#fb923c',
                  cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: 12,
                }}
              >
                重新登录
              </button>
              后自动继续保存，或
              <a
                href={config.apiBaseUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#fb923c', marginLeft: 2 }}
              >
                回网站点「连接插件」
              </a>
            </span>
          ) : saveError === 'generic' ? (
            <span className="crow-error" style={{ fontSize: 12 }}>
              保存失败，请稍后重试
            </span>
          ) : duplicate ? (
            <>
              <button
                className="crow-save-btn"
                onClick={handleKeepBoth}
                disabled={isSaving}
                type="button"
              >
                {isSaving ? '保存中…' : '都保留'}
              </button>
              <span className="crow-sep">·</span>
              <button
                className="crow-save-btn"
                onClick={handleReplace}
                disabled={isSaving}
                type="button"
                style={{ color: '#fb923c' }}
              >
                覆盖旧的
              </button>
            </>
          ) : (
            <button
              className="crow-save-btn"
              onClick={handleSave}
              disabled={isSaving}
              type="button"
            >
              {isSaving ? '保存中…' : '存入笔记本'}
            </button>
          )}
          {tag && !savedId && (
            <span className="crow-hint" style={{ fontSize: 12, color: '#34d399' }} title="保存时自动带上这个分类">
              🏷 {tag}
            </span>
          )}
          {isAuthenticated && (
            <>
              <span className="crow-sep">·</span>
              <a className="crow-save-btn" href={notebookUrl} target="_blank" rel="noreferrer">
                打开笔记本
              </a>
            </>
          )}
          <span className="crow-sep">·</span>
          <button
            className="crow-save-btn"
            onClick={() => setFollowUpOpen((v) => !v)}
            type="button"
          >
            {followUpOpen ? '收起追问' : '追问'}
          </button>
          <span className="crow-sep">·</span>
          <span className="crow-hint">Esc 关闭</span>
        </div>
      )}

      {/* ── 追问输入框 ── */}
      {followUpOpen && (
        <div className="crow-followup">
          <input
            autoFocus
            aria-label="追问问题"
            value={followUpText}
            onChange={(e) => setFollowUpText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
              handleFollowUpSubmit();
            }}
            placeholder="输入你想追问的问题，回车发送"
            className="crow-followup-input"
          />
          <button
            onClick={handleFollowUpSubmit}
            disabled={!followUpText.trim()}
            className="crow-followup-btn"
            type="button"
          >
            发送
          </button>
        </div>
      )}
    </div>
  );
}
