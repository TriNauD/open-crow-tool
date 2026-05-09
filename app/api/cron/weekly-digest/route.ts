import { NextRequest, NextResponse } from 'next/server';
import { fetchTrending, type TrendingRepo } from '@/lib/github-trending';
import {
  sendWeeklyDigest,
  sendDigestOpsReportComplete,
  sendDigestOpsReportAborted,
  type ReviewedRepo,
  type Tier,
} from '@/lib/email';
import { getActiveSubscribers } from '@/lib/db/subscribers';
import {
  getPrimaryProvider,
  getOpenAIForProvider,
  getModelForProvider,
} from '@/lib/ai/providers';

// Vercel hobby: 60s max, pro: 300s
export const maxDuration = 60;

const VALID_TIERS: Tier[] = ['夯', '顶级', '人上人', 'NPC', '拉完了'];

function buildReviewPrompt(repos: TrendingRepo[]): string {
  const list = repos
    .map(
      (r, i) =>
        `${i + 1}. ${r.name} | Stars: ${r.totalStars} (+${r.weeklyStars} this week) | Lang: ${r.language}\n   ${r.description}`
    )
    .join('\n');

  return `你是一个技术评审专家，直白说人话，不废话。

下面是本周 GitHub Trending Top ${repos.length}，请对每个项目评审并返回 JSON 数组。

要求：
- summary：一句话中文大白话，说清楚这玩意是干嘛的，风格直白口语化
- tech_score：技术创新性，1-5分（1=纯CRUD，5=颠覆性技术）
- scene_score：场景创新性，1-5分（1=没人需要，5=所有人都需要）
- tier：根据综合判断归入以下档位之一：夯、顶级、人上人、NPC、拉完了

项目列表：
${list}

严格返回 JSON 数组，不要输出其他任何内容，格式如下：
[
  {
    "name": "owner/repo",
    "url": "https://github.com/owner/repo",
    "summary": "一句话大白话总结",
    "tech_score": 4,
    "scene_score": 3,
    "tier": "顶级"
  }
]`;
}

function parseReviewedRepos(raw: string): ReviewedRepo[] {
  // Extract JSON array from response (handle markdown code blocks)
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON array found in AI response');

  const parsed = JSON.parse(jsonMatch[0]) as ReviewedRepo[];

  return parsed.map((item) => ({
    name: item.name ?? '',
    url: item.url ?? `https://github.com/${item.name}`,
    summary: item.summary ?? '',
    tech_score: Math.min(5, Math.max(1, Number(item.tech_score) || 3)),
    scene_score: Math.min(5, Math.max(1, Number(item.scene_score) || 3)),
    tier: VALID_TIERS.includes(item.tier) ? item.tier : 'NPC',
  })).filter((r) => r.name && r.summary);
}

function fallbackRepos(repos: TrendingRepo[]): ReviewedRepo[] {
  return repos.map((r) => ({
    name: r.name,
    url: r.url,
    summary: r.description || '（暂无描述）',
    tech_score: 3,
    scene_score: 3,
    tier: 'NPC',
  }));
}

export async function GET(req: NextRequest) {
  // Auth: Vercel Cron passes Authorization: Bearer CRON_SECRET automatically
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('Authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const langFilter = process.env.DIGEST_LANGUAGE_FILTER ?? '';
  const log: Record<string, unknown> = {};

  // 1. Fetch trending
  let trending: TrendingRepo[] = [];
  try {
    trending = await fetchTrending(langFilter || undefined);
    log.fetched = trending.length;
  } catch (err) {
    log.fetchError = String(err);
    try {
      await sendDigestOpsReportAborted({
        ranAtIso: new Date().toISOString(),
        stage: 'fetch-trending',
        message: '抓取 GitHub Trending 失败，未进入 AI 与发信。',
        extra: { log },
      });
    } catch (notifyErr) {
      console.error('[weekly-digest] ops notify failed:', notifyErr);
    }
    return NextResponse.json({ error: 'Failed to fetch trending', log }, { status: 500 });
  }

  if (trending.length === 0) {
    try {
      await sendDigestOpsReportAborted({
        ranAtIso: new Date().toISOString(),
        stage: 'fetch-trending',
        message: 'Trending 列表为空，未发送任何订阅邮件。',
        extra: { log },
      });
    } catch (notifyErr) {
      console.error('[weekly-digest] ops notify failed:', notifyErr);
    }
    return NextResponse.json({ error: 'No trending repos found', log }, { status: 500 });
  }

  // 2. AI batch review
  let reviewed: ReviewedRepo[];
  let aiUsed = true;
  try {
    const provider = getPrimaryProvider();
    const client = getOpenAIForProvider(provider);
    const model = getModelForProvider(provider);

    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: buildReviewPrompt(trending) }],
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    reviewed = parseReviewedRepos(raw);
    log.aiReviewed = reviewed.length;

    const tierCount: Record<string, number> = {};
    for (const r of reviewed) tierCount[r.tier] = (tierCount[r.tier] ?? 0) + 1;
    log.tierDistribution = tierCount;
  } catch (err) {
    console.error('[weekly-digest] AI review failed, using fallback:', err);
    reviewed = fallbackRepos(trending);
    aiUsed = false;
    log.aiError = String(err);
    log.fallback = true;
  }

  const baseUrl = new URL(req.url).origin;

  // 3. Fan-out: fetch all active subscribers, then decide who gets the email
  //
  // SUBSCRIBER_SEND_ENABLED=SEND_TO_SUBSCRIBERS → all active subscribers
  // Otherwise (dev/test mode)                  → active subscribers whose email is in DIGEST_TEST_EMAILS
  //
  // Either way, recipients must be in the DB as active — no bypass.
  const subscriberSendEnabled = process.env.SUBSCRIBER_SEND_ENABLED === 'SEND_TO_SUBSCRIBERS';
  const testEmailSet = new Set(
    (process.env.DIGEST_TEST_EMAILS ?? process.env.DIGEST_TO_EMAIL ?? '')
      .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  );

  const allActive = await getActiveSubscribers();
  const recipients = subscriberSendEnabled
    ? allActive
    : allActive.filter((sub) => testEmailSet.has(sub.email.toLowerCase()));

  const sendResults: { email: string; ok: boolean }[] = [];

  for (const sub of recipients) {
    try {
      const unsubscribeUrl = `${baseUrl}/api/unsubscribe?token=${sub.unsubscribe_token}`;
      await sendWeeklyDigest(reviewed, sub.email, unsubscribeUrl);
      sendResults.push({ email: sub.email, ok: true });
    } catch (err) {
      console.error(`[weekly-digest] Failed to send to ${sub.email}:`, err);
      sendResults.push({ email: sub.email, ok: false });
    }
    // Resend rate limit is 2 req/s; wait 600ms between sends to stay within bounds
    await new Promise((r) => setTimeout(r, 600));
  }

  log.subscriberSendEnabled = subscriberSendEnabled;
  log.activeSubscribers = allActive.length;
  log.recipientCount = recipients.length;
  log.sendResults = sendResults;
  const sendFail = sendResults.filter((r) => !r.ok).length;
  const sendOk = sendResults.filter((r) => r.ok).length;
  log.emailSent = sendResults.length > 0 && sendResults.every((r) => r.ok);

  const allSubscriberSendsOk = sendFail === 0;

  try {
    await sendDigestOpsReportComplete({
      ranAtIso: new Date().toISOString(),
      allSubscriberSendsOk,
      subscriberSendEnabled,
      activeSubscribers: allActive.length,
      recipientCount: recipients.length,
      sendOk,
      sendFail,
      failedEmails: sendResults.filter((r) => !r.ok).map((r) => r.email),
      aiUsed,
      fetchedTrendingCount: typeof log.fetched === 'number' ? log.fetched : undefined,
      tierDistribution: log.tierDistribution as Record<string, number> | undefined,
      aiError: typeof log.aiError === 'string' ? log.aiError : undefined,
      fetchError: typeof log.fetchError === 'string' ? log.fetchError : undefined,
      fallback: log.fallback === true,
    });
  } catch (notifyErr) {
    console.error('[weekly-digest] ops notify failed:', notifyErr);
  }

  return NextResponse.json({ ok: true, aiUsed, log });
}
