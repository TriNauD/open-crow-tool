'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  EFFECTIVE_PROVIDER_HEADER,
  USER_LLM_CONFIG_HEADER,
  clearStoredUserLLMConfig,
  encodeUserLLMConfigHeader,
  loadStoredUserLLMConfig,
  normalizeUserLLMInput,
  saveStoredUserLLMConfig,
} from '@/lib/user-llm-config';

type TestState = {
  status: 'idle' | 'testing' | 'ok' | 'fallback' | 'fail';
  message: string;
};

export default function SettingsPage() {
  const [baseURL, setBaseURL] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [test, setTest] = useState<TestState>({ status: 'idle', message: '' });

  useEffect(() => {
    // setTimeout 内读 localStorage，避免 SSR 水合不一致与 effect 内同步 setState
    const id = window.setTimeout(() => {
      const cfg = loadStoredUserLLMConfig();
      if (cfg) {
        setBaseURL(cfg.baseURL);
        setApiKey(cfg.apiKey);
        setModel(cfg.model);
        setEnabled(true);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError('');
    setSaved(false);
    const cfg = normalizeUserLLMInput({ baseURL, apiKey, model });
    if (!cfg) {
      setSaveError('请填写完整的 API 地址（https:// 开头）、API Key 和模型名');
      return;
    }
    saveStoredUserLLMConfig(cfg);
    setBaseURL(cfg.baseURL);
    setApiKey(cfg.apiKey);
    setModel(cfg.model);
    setEnabled(true);
    setSaved(true);
    setTest({ status: 'idle', message: '' });
    setTimeout(() => setSaved(false), 2500);
  }

  function handleClear() {
    clearStoredUserLLMConfig();
    setBaseURL('');
    setApiKey('');
    setModel('');
    setEnabled(false);
    setSaveError('');
    setTest({ status: 'idle', message: '' });
  }

  async function handleTest() {
    const cfg = normalizeUserLLMInput({ baseURL, apiKey, model });
    if (!cfg) {
      setTest({ status: 'fail', message: '请先填写并保存完整配置' });
      return;
    }
    setTest({ status: 'testing', message: '' });
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [USER_LLM_CONFIG_HEADER]: encodeUserLLMConfigHeader(cfg),
        },
        body: JSON.stringify({ text: 'hi' }),
      });
      if (!res.ok) {
        const msg = await res.text();
        setTest({ status: 'fail', message: msg || `请求失败（${res.status}）` });
        return;
      }
      await res.text(); // 消费流，避免连接悬挂
      const provider = res.headers.get(EFFECTIVE_PROVIDER_HEADER) ?? '';
      if (provider === 'custom') {
        setTest({
          status: 'ok',
          message: `✓ 测试成功，正在使用你配置的 API（${cfg.model}）`,
        });
      } else {
        setTest({
          status: 'fallback',
          message: `请求成功，但回退到了默认通道（${provider}）。你的 API 配置可能无效（地址、Key 或模型名不对），已不影响使用。`,
        });
      }
    } catch {
      setTest({ status: 'fail', message: '网络错误，请稍后再试' });
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800 px-4 sm:px-6 py-4 flex items-center justify-between shrink-0">
        <Link
          href="/"
          className="font-bold text-lg tracking-tight text-white hover:text-orange-400 transition-colors"
        >
          这是啥<span className="text-orange-400">？</span>
        </Link>
        <span className="text-sm text-zinc-500">设置</span>
      </header>

      <main className="flex-1 px-4 py-10 max-w-2xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-1">自定义 AI 接口</h1>
        <p className="text-zinc-500 text-sm mb-6">
          可选。填写任何 OpenAI 兼容接口（OpenAI、DeepSeek、Kimi、智谱、SiliconFlow、Ollama
          中转等），解释将优先走你自己的 API；失败时自动回退到默认通道。
        </p>

        <div
          className={`mb-6 text-sm px-3 py-2 rounded-lg border inline-flex items-center gap-2 ${
            enabled
              ? 'border-green-700 text-green-400 bg-green-500/10'
              : 'border-zinc-700 text-zinc-500'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-zinc-600'}`} />
          {enabled ? '已启用自定义 API' : '未启用，使用默认通道'}
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label htmlFor="llm-base-url" className="block text-sm font-semibold text-zinc-300 mb-1.5">
              API Base URL
            </label>
            <input
              id="llm-base-url"
              type="url"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              placeholder="https://api.deepseek.com/v1"
              spellCheck={false}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            />
            <p className="text-xs text-zinc-600 mt-1">
              以 /v1 结尾的接口根地址，不用拼 /chat/completions
            </p>
          </div>

          <div>
            <label htmlFor="llm-api-key" className="block text-sm font-semibold text-zinc-300 mb-1.5">
              API Key
            </label>
            <input
              id="llm-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
              spellCheck={false}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            />
            <p className="text-xs text-zinc-600 mt-1">
              Key 只保存在本浏览器（localStorage），不会上传或存储到服务器
            </p>
          </div>

          <div>
            <label htmlFor="llm-model" className="block text-sm font-semibold text-zinc-300 mb-1.5">
              模型名
            </label>
            <input
              id="llm-model"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="deepseek-chat"
              spellCheck={false}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            />
          </div>

          {saveError ? <p className="text-sm text-red-400">{saveError}</p> : null}
          {test.message ? (
            <p
              className={`text-sm leading-relaxed ${
                test.status === 'ok'
                  ? 'text-green-400'
                  : test.status === 'fallback'
                    ? 'text-amber-400'
                    : test.status === 'fail'
                      ? 'text-red-400'
                      : 'text-zinc-400'
              }`}
            >
              {test.message}
            </p>
          ) : null}

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="submit"
              className={`text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors ${
                saved ? 'bg-green-500 text-white' : 'bg-orange-500 hover:bg-orange-400 text-white'
              }`}
            >
              {saved ? '✓ 已保存' : '保存'}
            </button>
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={test.status === 'testing'}
              className="text-sm font-semibold px-5 py-2.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-300 transition-colors disabled:opacity-60"
            >
              {test.status === 'testing' ? '测试中…' : '测试连接'}
            </button>
            {enabled ? (
              <button
                type="button"
                onClick={handleClear}
                className="text-sm px-4 py-2.5 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                清除配置
              </button>
            ) : null}
          </div>
        </form>
      </main>
    </div>
  );
}
