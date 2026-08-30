import Link from 'next/link';
import { getSubscriberByToken } from '@/lib/db/subscribers';

function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; status?: string }>;
}) {
  const { token, status } = await searchParams;

  // 两步退订第一步：带 token 的确认页。只读查询，页面渲染不会改动订阅状态。
  let subscriberEmail: string | null = null;
  if (token) {
    const subscriber = await getSubscriberByToken(token).catch((err) => {
      console.error('[unsubscribe page] lookup failed:', err);
      return null;
    });
    subscriberEmail = subscriber?.email ?? null;
  }

  const config = {
    success: {
      icon: '✓',
      iconColor: 'text-green-400',
      iconBg: 'bg-green-500/10 border-green-500/30',
      title: '已退订',
      message: '你已成功退订，不会再收到我们的邮件。如果改变主意，随时可以重新订阅。',
    },
    notfound: {
      icon: '?',
      iconColor: 'text-zinc-400',
      iconBg: 'bg-zinc-800 border-zinc-700',
      title: '链接无效',
      message: '这个退订链接无效或已失效。如果你已经退订过了，不用担心，你的邮箱不在名单上。',
    },
    invalid: {
      icon: '!',
      iconColor: 'text-yellow-400',
      iconBg: 'bg-yellow-500/10 border-yellow-500/30',
      title: '缺少参数',
      message: '退订链接格式不正确，请使用邮件底部的退订链接。',
    },
  }[status ?? (token ? 'notfound' : 'invalid')] ?? {
    icon: '!',
    iconColor: 'text-yellow-400',
    iconBg: 'bg-yellow-500/10 border-yellow-500/30',
    title: '出了点问题',
    message: '请使用邮件底部的退订链接。',
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-4">
        <Link
          href="/"
          className="font-bold text-lg tracking-tight text-white hover:text-orange-400 transition-colors"
        >
          这是啥<span className="text-orange-400">？</span>
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        {token && subscriberEmail ? (
          // 确认模式：点了邮件里的退订链接，但还没真正退订
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border text-2xl font-bold mb-6 bg-orange-500/10 border-orange-500/30 text-orange-400">
              ?
            </div>
            <h1 className="text-2xl font-bold mb-3">确认退订？</h1>
            <p className="text-zinc-400 text-sm max-w-sm leading-relaxed mb-2">
              确认后，邮箱 <span className="text-zinc-200">{maskEmail(subscriberEmail)}</span>{' '}
              将不再收到每周 GitHub 热榜邮件。
            </p>
            <p className="text-zinc-600 text-xs max-w-sm mb-8">
              点「确认退订」才会生效；不想退的话直接关掉这个页面就行。
            </p>
            <form method="post" action="/api/unsubscribe" className="flex items-center gap-4">
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="bg-red-500 hover:bg-red-400 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
              >
                确认退订
              </button>
            </form>
            <Link
              href="/"
              className="mt-4 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              我再想想，继续收信
            </Link>
          </>
        ) : (
          // 状态模式：退订成功 / 链接无效等
          <>
            <div
              className={`inline-flex items-center justify-center w-16 h-16 rounded-full border text-2xl font-bold mb-6 ${config.iconBg} ${config.iconColor}`}
            >
              {config.icon}
            </div>
            <h1 className="text-2xl font-bold mb-3">{config.title}</h1>
            <p className="text-zinc-400 text-sm max-w-sm leading-relaxed mb-8">
              {config.message}
            </p>
            {status === 'success' && (
              <Link
                href="/subscribe"
                className="text-sm text-zinc-500 hover:text-zinc-300 border border-zinc-700 hover:border-zinc-500 px-4 py-2 rounded-lg transition-colors"
              >
                重新订阅
              </Link>
            )}
          </>
        )}
      </main>
    </div>
  );
}
