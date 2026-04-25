import Link from 'next/link';

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

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
  }[status ?? 'invalid'] ?? {
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
          这他妈是啥<span className="text-orange-400">？</span>
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
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
      </main>
    </div>
  );
}
