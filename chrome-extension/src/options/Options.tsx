import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CROW_AUTH_LOCAL_KEYS,
  CROW_EXTENSION_ENABLED_KEY,
  clearCrowAuth,
  ensureFreshAuth,
  getBuildSiteOrigin,
  getBuildSupabasePublic,
  isExplainEnabled,
  loadCrowAuth,
  persistCrowAuth,
  setExplainEnabled,
  type CrowAuth,
} from '../lib/crow-session';
import { performSupabasePasswordLogin } from '../lib/supabase-password-login';
import {
  CROW_EFFECTIVE_PROVIDER_HEADER,
  CROW_USER_LLM_HEADER,
  CROW_USER_LLM_KEY,
  clearUserLlmConfig,
  encodeUserLlmConfigHeader,
  loadUserLlmConfig,
  normalizeUserLlmConfig,
  saveUserLlmConfig,
} from '../lib/user-llm-config';

export default function Options() {
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [manualUrl, setManualUrl] = useState(() => getBuildSiteOrigin());
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshHint, setRefreshHint] = useState('');
  const [explainOn, setExplainOn] = useState(true);

  const [showLlm, setShowLlm] = useState(false);
  const [llmBaseURL, setLlmBaseURL] = useState('');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmModel, setLlmModel] = useState('');
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [llmSaved, setLlmSaved] = useState(false);
  const [llmError, setLlmError] = useState('');
  const [llmTest, setLlmTest] = useState<{
    status: 'idle' | 'testing' | 'ok' | 'fallback' | 'fail';
    message: string;
  }>({ status: 'idle', message: '' });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [logoutLoading, setLogoutLoading] = useState(false);

  /** 忽略本轮 local 授权键变更（登录 / 手动保存 / 设置内刷新），避免误显示「网站已同步」 */
  const skipAuthStorageEventsRef = useRef(false);

  const applyAuthStateFromStorage = useCallback(
    async (opts: { showWebSyncHint: boolean }) => {
      const auth = await loadCrowAuth();
      const sync = await chrome.storage.sync.get(['adminSecret']);
      const url = auth?.apiBaseUrl || '';
      const token = auth?.accessToken || '';
      setApiBaseUrl(url);
      setAccessToken(token);
      setManualUrl(url || getBuildSiteOrigin());
      setManualToken(token);
      if (!token && sync.adminSecret) {
        setError('检测到旧版配置，请在上方登录，或在网站登录后点「连接插件」。');
      } else {
        setError('');
      }
      if (opts.showWebSyncHint && token) {
        setRefreshHint('已通过网站同步连接状态。');
        setTimeout(() => setRefreshHint(''), 2800);
      }
    },
    []
  );

  const refreshLlmState = useCallback(async () => {
    const cfg = await loadUserLlmConfig();
    if (cfg) {
      setLlmBaseURL(cfg.baseURL);
      setLlmApiKey(cfg.apiKey);
      setLlmModel(cfg.model);
      setLlmEnabled(true);
    } else {
      setLlmEnabled(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void applyAuthStateFromStorage({ showWebSyncHint: false });
      void isExplainEnabled().then(setExplainOn);
      void refreshLlmState();
    }, 0);
    return () => window.clearTimeout(id);
  }, [applyAuthStateFromStorage, refreshLlmState]);

  useEffect(() => {
    function onBecameVisible() {
      if (document.visibilityState !== 'visible') return;
      void applyAuthStateFromStorage({ showWebSyncHint: false });
    }
    document.addEventListener('visibilitychange', onBecameVisible);
    window.addEventListener('focus', onBecameVisible);
    return () => {
      document.removeEventListener('visibilitychange', onBecameVisible);
      window.removeEventListener('focus', onBecameVisible);
    };
  }, [applyAuthStateFromStorage]);

  useEffect(() => {
    function onStorageChanged(
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: chrome.storage.AreaName
    ) {
      if (areaName !== 'local') return;
      if (changes[CROW_EXTENSION_ENABLED_KEY] !== undefined) {
        setExplainOn(changes[CROW_EXTENSION_ENABLED_KEY].newValue !== false);
      }
      if (changes[CROW_USER_LLM_KEY] !== undefined) {
        void refreshLlmState();
      }
      const hit = CROW_AUTH_LOCAL_KEYS.some((k) => changes[k] !== undefined);
      if (!hit || skipAuthStorageEventsRef.current) return;
      void applyAuthStateFromStorage({ showWebSyncHint: true });
    }
    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => chrome.storage.onChanged.removeListener(onStorageChanged);
  }, [applyAuthStateFromStorage, refreshLlmState]);

  const isConnected = !!(apiBaseUrl && accessToken);
  const siteOrigin = apiBaseUrl || getBuildSiteOrigin();

  async function refreshConnectionStatus() {
    skipAuthStorageEventsRef.current = true;
    setIsRefreshing(true);
    setRefreshHint('');
    try {
      const before = await loadCrowAuth();
      const after = await ensureFreshAuth(before, { force: true });
      const sync = await chrome.storage.sync.get(['adminSecret']);
      const fromDisk = after ?? (await loadCrowAuth());

      if (fromDisk?.accessToken) {
        setApiBaseUrl(fromDisk.apiBaseUrl);
        setAccessToken(fromDisk.accessToken);
        setManualUrl(fromDisk.apiBaseUrl);
        setManualToken(fromDisk.accessToken);
      } else {
        setApiBaseUrl('');
        setAccessToken('');
      }

      if (after) {
        setRefreshHint('连接状态已更新（如已续期会话）。');
        setTimeout(() => setRefreshHint(''), 2800);
      } else if (before) {
        setRefreshHint('未能续期会话，请在下方重新登录，或在网站点「连接插件」。');
      } else {
        setRefreshHint('当前无已保存的登录状态。');
      }

      if (!fromDisk?.accessToken && sync.adminSecret) {
        setError('检测到旧版配置，请在上方登录，或在网站登录后点「连接插件」。');
      } else if (!fromDisk?.accessToken) {
        setError('');
      }
    } finally {
      setIsRefreshing(false);
      queueMicrotask(() => {
        skipAuthStorageEventsRef.current = false;
      });
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loginLoading) return;
    setLoginError('');
    setError('');
    setLoginLoading(true);
    skipAuthStorageEventsRef.current = true;
    try {
      const { url, anonKey } = getBuildSupabasePublic();
      const result = await performSupabasePasswordLogin(url, anonKey, email, password);
      if (!result.ok) {
        setLoginError(result.message);
        return;
      }
      const auth: CrowAuth = {
        apiBaseUrl: getBuildSiteOrigin(),
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
        supabaseUrl: url,
        supabaseAnonKey: anonKey,
        expiresAt: result.expires_at,
      };
      await persistCrowAuth(auth);
      setApiBaseUrl(auth.apiBaseUrl);
      setAccessToken(auth.accessToken);
      setManualUrl(auth.apiBaseUrl);
      setManualToken(auth.accessToken);
      setPassword('');
      setRefreshHint('登录成功，已连接到你的账号。回到网页重新划词即可保存。');
      setTimeout(() => setRefreshHint(''), 2800);
    } finally {
      setLoginLoading(false);
      queueMicrotask(() => {
        skipAuthStorageEventsRef.current = false;
      });
    }
  }

  async function handleLogout() {
    if (logoutLoading) return;
    setLogoutLoading(true);
    setLoginError('');
    setError('');
    skipAuthStorageEventsRef.current = true;
    try {
      await clearCrowAuth();
      setApiBaseUrl('');
      setAccessToken('');
      setManualToken('');
      setManualUrl(getBuildSiteOrigin());
      setRefreshHint('已退出登录。');
      setTimeout(() => setRefreshHint(''), 2800);
    } finally {
      setLogoutLoading(false);
      queueMicrotask(() => {
        skipAuthStorageEventsRef.current = false;
      });
    }
  }

  async function handleManualSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const url = manualUrl.trim().replace(/\/$/, '');
    if (!url) { setError('请填写 API 地址'); return; }
    if (!manualToken.trim()) { setError('请填写访问令牌'); return; }
    skipAuthStorageEventsRef.current = true;
    try {
      const { url: sbUrl, anonKey } = getBuildSupabasePublic();
      await persistCrowAuth({
        apiBaseUrl: url,
        accessToken: manualToken.trim(),
        refreshToken: '',
        supabaseUrl: sbUrl,
        supabaseAnonKey: anonKey,
        expiresAt: undefined,
      });
      setApiBaseUrl(url);
      setAccessToken(manualToken.trim());
      setError('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      queueMicrotask(() => {
        skipAuthStorageEventsRef.current = false;
      });
    }
  }

  async function handleLlmSave(e: React.FormEvent) {
    e.preventDefault();
    setLlmError('');
    setLlmSaved(false);
    const cfg = normalizeUserLlmConfig({
      baseURL: llmBaseURL,
      apiKey: llmApiKey,
      model: llmModel,
    });
    if (!cfg) {
      setLlmError('请填写完整的 API 地址（https:// 开头）、API Key 和模型名');
      return;
    }
    await saveUserLlmConfig(cfg);
    setLlmBaseURL(cfg.baseURL);
    setLlmApiKey(cfg.apiKey);
    setLlmModel(cfg.model);
    setLlmEnabled(true);
    setLlmSaved(true);
    setLlmTest({ status: 'idle', message: '' });
    setTimeout(() => setLlmSaved(false), 2500);
  }

  async function handleLlmClear() {
    await clearUserLlmConfig();
    setLlmBaseURL('');
    setLlmApiKey('');
    setLlmModel('');
    setLlmEnabled(false);
    setLlmError('');
    setLlmTest({ status: 'idle', message: '' });
  }

  /** 与网站 /settings 的「测试连接」同逻辑：发最小解释请求，读 X-Crow-Provider 判断是否真走用户 API */
  async function handleLlmTest() {
    const cfg = normalizeUserLlmConfig({
      baseURL: llmBaseURL,
      apiKey: llmApiKey,
      model: llmModel,
    });
    if (!cfg) {
      setLlmTest({ status: 'fail', message: '请先填写完整的 API 地址、API Key 和模型名' });
      return;
    }
    setLlmTest({ status: 'testing', message: '' });
    try {
      const res = await fetch(`${siteOrigin}/api/explain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [CROW_USER_LLM_HEADER]: encodeUserLlmConfigHeader(cfg),
        },
        body: JSON.stringify({ text: 'hi' }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => `请求失败（${res.status}）`);
        setLlmTest({ status: 'fail', message: msg || `请求失败（${res.status}）` });
        return;
      }
      await res.text(); // 消费流，避免连接悬挂
      const provider = res.headers.get(CROW_EFFECTIVE_PROVIDER_HEADER) ?? '';
      if (provider === 'custom') {
        setLlmTest({
          status: 'ok',
          message: `✓ 测试成功，正在使用你配置的 API（${cfg.model}）`,
        });
      } else if (provider) {
        setLlmTest({
          status: 'fallback',
          message: `请求成功，但回退到了默认通道（${provider}）。你的 API 配置可能无效（地址、Key 或模型名不对），已不影响使用。`,
        });
      } else {
        setLlmTest({
          status: 'fail',
          message: '站点后端未返回生效通道，请更新网站代码到含「用户自配 API」的版本后重试。',
        });
      }
    } catch {
      setLlmTest({
        status: 'fail',
        message: '网络错误：无法连接站点后端，请检查上方「API 地址」与网络。',
      });
    }
  }

  function openSite() {
    chrome.tabs.create({ url: siteOrigin });
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>
          这是啥<span style={{ color: '#f97316' }}>？</span> — 设置
        </h1>

        <div style={styles.statusBox}>
          <div style={styles.statusRow}>
            <span style={isConnected ? styles.dotGreen : styles.dotRed} />
            <span style={styles.statusTextWrap}>
              {isConnected ? '插件已连接到你的账号' : '尚未登录'}
            </span>
            <button
              type="button"
              onClick={() => void refreshConnectionStatus()}
              disabled={isRefreshing}
              style={isRefreshing ? styles.btnRefreshDisabled : styles.btnRefresh}
            >
              {isRefreshing ? '刷新中…' : '刷新状态'}
            </button>
          </div>
          {isConnected && (
            <p style={styles.statusHint}>{apiBaseUrl}</p>
          )}
          {refreshHint ? (
            <p
              style={{
                ...styles.refreshHint,
                color:
                  refreshHint.startsWith('连接状态已更新') ||
                  refreshHint.startsWith('已通过网站') ||
                  refreshHint.startsWith('登录成功')
                    ? '#22c55e'
                    : refreshHint.startsWith('未能续期')
                      ? '#fbbf24'
                      : '#71717a',
              }}
            >
              {refreshHint}
            </p>
          ) : null}
        </div>

        <div style={styles.toggleRow}>
          <div>
            <span style={styles.toggleLabel}>划词解释</span>
            <span style={styles.toggleHint}>
              {explainOn ? '选词时显示解释按钮' : '已暂停，选词不触发解释'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !explainOn;
              setExplainOn(next);
              void setExplainEnabled(next);
            }}
            style={{
              background: explainOn ? '#22c55e' : '#3f3f46',
              border: 'none',
              borderRadius: 12,
              width: 44,
              height: 24,
              position: 'relative',
              cursor: 'pointer',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: explainOn ? 22 : 2,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s',
              }}
            />
          </button>
        </div>

        {/* 主路径：扩展内登录 / 已登录操作 */}
        <div style={styles.primaryAction}>
          {isConnected ? (
            <>
              <p style={styles.desc}>
                已登录。长时间不用时插件会自动续期；若提示过期，请重新登录，或在网站点「连接插件」同步。
                后一次成功写入会覆盖前一次（扩展登录与网站连接共用同一套凭证）。
              </p>
              <div style={styles.btnRow}>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={logoutLoading}
                  style={styles.btnSecondaryFull}
                >
                  {logoutLoading ? '退出中…' : '退出登录'}
                </button>
                <button
                  type="button"
                  onClick={openSite}
                  style={{ ...styles.btnGhost, width: 'auto', marginTop: 0, flex: '1 1 120px' }}
                >
                  打开网站
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={styles.desc}>
                用与网站相同的邮箱和密码登录，即可划词存笔记。无需复制令牌。
              </p>
              <form onSubmit={(e) => void handleLogin(e)}>
                <div style={styles.field}>
                  <label style={styles.label} htmlFor="crow-login-email">邮箱</label>
                  <input
                    id="crow-login-email"
                    style={styles.input}
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label} htmlFor="crow-login-password">密码</label>
                  <input
                    id="crow-login-password"
                    style={styles.input}
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="密码"
                    required
                  />
                </div>
                {loginError ? <p style={styles.error}>{loginError}</p> : null}
                <button
                  type="submit"
                  disabled={loginLoading}
                  style={loginLoading ? styles.btnPrimaryDisabled : styles.btnPrimary}
                >
                  {loginLoading ? '登录中…' : '登录'}
                </button>
              </form>
              <p style={{ ...styles.desc, marginTop: 14, marginBottom: 8 }}>
                还没有账号？
                <button type="button" onClick={openSite} style={styles.linkBtn}>
                  去网站注册
                </button>
                ，或已在网站登录时用「连接插件」同步到本扩展。
              </p>
              <button type="button" onClick={openSite} style={styles.btnGhost}>
                打开网站（连接插件）
              </button>
            </>
          )}
        </div>

        <hr style={styles.divider} />

        {/* 自定义 AI 接口（可选）：划词解释优先走用户自己的 OpenAI-compatible API */}
        <button
          type="button"
          onClick={() => setShowLlm((v) => !v)}
          style={styles.toggleManual}
        >
          {showLlm ? '▲ 收起自定义 AI 接口' : '▼ 自定义 AI 接口（可选）'}
        </button>

        {showLlm && (
          <form onSubmit={(e) => void handleLlmSave(e)} style={{ marginTop: 16 }}>
            <div style={{ ...styles.statusBox, marginBottom: 14 }}>
              <div style={styles.statusRow}>
                <span style={llmEnabled ? styles.dotGreen : styles.dotRed} />
                <span style={styles.statusTextWrap}>
                  {llmEnabled ? '已启用自定义 API' : '未启用，走默认通道'}
                </span>
              </div>
            </div>
            <p style={styles.hint}>
              填写任何 OpenAI 兼容接口（OpenAI、DeepSeek、Kimi、SiliconFlow
              等），划词解释优先走你的 API，失败自动回退默认通道。Key 只保存在本机浏览器，不会上传存储。
            </p>
            <div style={styles.field}>
              <label style={styles.label}>API 地址</label>
              <input
                style={styles.input}
                type="url"
                value={llmBaseURL}
                onChange={(e) => setLlmBaseURL(e.target.value)}
                placeholder="https://api.deepseek.com/v1"
                spellCheck={false}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>API Key</label>
              <input
                style={styles.input}
                type="password"
                value={llmApiKey}
                onChange={(e) => setLlmApiKey(e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>模型名</label>
              <input
                style={styles.input}
                type="text"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                placeholder="deepseek-chat"
                spellCheck={false}
              />
            </div>
            {llmError && <p style={styles.error}>{llmError}</p>}
            {llmTest.message ? (
              <p
                style={{
                  ...styles.hint,
                  marginBottom: 12,
                  color:
                    llmTest.status === 'ok'
                      ? '#22c55e'
                      : llmTest.status === 'fallback'
                        ? '#fbbf24'
                        : llmTest.status === 'fail'
                          ? '#f87171'
                          : '#71717a',
                }}
              >
                {llmTest.message}
              </p>
            ) : null}
            <div style={styles.btnRow}>
              <button
                type="submit"
                style={llmSaved ? styles.btnSaved : styles.btnSecondary}
              >
                {llmSaved ? '✓ 已保存' : '保存'}
              </button>
              <button
                type="button"
                onClick={() => void handleLlmTest()}
                disabled={llmTest.status === 'testing'}
                style={{
                  ...styles.btnSecondary,
                  marginTop: 0,
                  opacity: llmTest.status === 'testing' ? 0.6 : 1,
                }}
              >
                {llmTest.status === 'testing' ? '测试中…' : '测试连接'}
              </button>
              {llmEnabled && (
                <button
                  type="button"
                  onClick={() => void handleLlmClear()}
                  style={{ ...styles.btnGhost, width: 'auto', marginTop: 0, flex: '0 1 auto' }}
                >
                  清除配置
                </button>
              )}
            </div>
          </form>
        )}

        <hr style={styles.divider} />

        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          style={styles.toggleManual}
        >
          {showManual ? '▲ 收起高级选项' : '▼ 高级选项（自托管 / 开发者）'}
        </button>

        {showManual && (
          <form onSubmit={(e) => void handleManualSave(e)} style={{ marginTop: 16 }}>
            <p style={styles.hint}>
              一般用户请用上方「登录」。此处仅在自托管或排障时手动填写 API 地址与令牌。
            </p>
            <div style={styles.field}>
              <label style={styles.label}>API 地址</label>
              <input
                style={styles.input}
                type="url"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder={getBuildSiteOrigin()}
                spellCheck={false}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>访问令牌</label>
              <input
                style={styles.input}
                type="password"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="仅开发者使用"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" style={saved ? styles.btnSaved : styles.btnSecondary}>
              {saved ? '✓ 已保存' : '保存'}
            </button>
          </form>
        )}

        {!showManual && error && <p style={{ ...styles.error, marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#09090b',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '48px 16px',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  card: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: 16,
    padding: '32px 28px',
    width: '100%',
    maxWidth: 480,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#f4f4f5',
    marginBottom: 20,
  },
  statusBox: {
    background: '#09090b',
    border: '1px solid #27272a',
    borderRadius: 10,
    padding: '14px 16px',
    marginBottom: 20,
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusTextWrap: {
    flex: '1 1 120px',
    minWidth: 0,
    fontSize: 14,
    fontWeight: 600,
    color: '#f4f4f5',
  },
  btnRefresh: {
    background: '#27272a',
    color: '#d4d4d8',
    border: '1px solid #3f3f46',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
    marginLeft: 'auto',
  },
  btnRefreshDisabled: {
    background: '#27272a',
    color: '#71717a',
    border: '1px solid #3f3f46',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'default',
    flexShrink: 0,
    marginLeft: 'auto',
    opacity: 0.85,
  },
  refreshHint: {
    fontSize: 12,
    marginTop: 8,
    marginLeft: 16,
    lineHeight: 1.5,
    marginBottom: 0,
  },
  dotGreen: {
    width: 8, height: 8, borderRadius: '50%',
    background: '#22c55e',
    flexShrink: 0,
  },
  dotRed: {
    width: 8, height: 8, borderRadius: '50%',
    background: '#f87171',
    flexShrink: 0,
  },
  statusHint: {
    fontSize: 12,
    color: '#52525b',
    marginTop: 4,
    marginLeft: 16,
  },
  primaryAction: {
    marginBottom: 8,
  },
  desc: {
    fontSize: 13,
    color: '#71717a',
    lineHeight: 1.6,
    marginBottom: 14,
  },
  btnPrimary: {
    background: '#f97316',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
  },
  btnPrimaryDisabled: {
    background: '#9a3412',
    color: '#fdba74',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'default',
    width: '100%',
    opacity: 0.9,
  },
  btnRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  btnSecondaryFull: {
    background: '#27272a',
    color: '#d4d4d8',
    border: '1px solid #3f3f46',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    flex: '1 1 140px',
  },
  btnGhost: {
    background: 'transparent',
    color: '#a1a1aa',
    border: '1px solid #3f3f46',
    borderRadius: 8,
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    marginTop: 8,
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#fb923c',
    fontSize: 13,
    cursor: 'pointer',
    padding: '0 4px',
    textDecoration: 'underline',
  },
  divider: {
    border: 'none',
    borderTop: '1px solid #27272a',
    margin: '20px 0',
  },
  toggleManual: {
    background: 'none',
    border: 'none',
    color: '#52525b',
    fontSize: 12,
    cursor: 'pointer',
    padding: 0,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#d4d4d8',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    background: '#09090b',
    border: '1px solid #3f3f46',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 14,
    color: '#f4f4f5',
    outline: 'none',
    boxSizing: 'border-box',
  },
  hint: {
    fontSize: 12,
    color: '#52525b',
    marginTop: 5,
    marginBottom: 12,
    lineHeight: 1.5,
  },
  error: {
    fontSize: 13,
    color: '#f87171',
    lineHeight: 1.5,
    marginBottom: 10,
  },
  btnSecondary: {
    background: '#27272a',
    color: '#d4d4d8',
    border: '1px solid #3f3f46',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
  },
  btnSaved: {
    background: '#22c55e',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'default',
    marginTop: 4,
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderTop: '1px solid #27272a',
    marginTop: 0,
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: '#f4f4f5',
    display: 'block',
  },
  toggleHint: {
    fontSize: 12,
    color: '#71717a',
    display: 'block',
    marginTop: 2,
  },
};
