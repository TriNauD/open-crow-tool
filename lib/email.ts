import { Resend } from 'resend';
import nodemailer from 'nodemailer';

export type Tier = '夯' | '顶级' | '人上人' | 'NPC' | '拉完了';

// ─── Shared transport ────────────────────────────────────────────────────────

async function sendMail(to: string, subject: string, html: string): Promise<void> {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const user = process.env.SMTP_USER;
    const isGmail = user.endsWith('@gmail.com');
    const transporter = nodemailer.createTransport(
      isGmail
        ? { service: 'gmail', auth: { user, pass: process.env.SMTP_PASS } }
        : { host: 'smtp-mail.outlook.com', port: 587, secure: false, auth: { user, pass: process.env.SMTP_PASS } }
    );
    await transporter.sendMail({ from: user, to, subject, html });
    return;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM ?? 'onboarding@resend.dev';
  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);
}

export interface ReviewedRepo {
  name: string;
  url: string;
  summary: string;
  tech_score: number;
  scene_score: number;
  tier: Tier;
}

const TIER_ORDER: Tier[] = ['夯', '顶级', '人上人', 'NPC', '拉完了'];

const TIER_STYLE: Record<Tier, { bg: string; color: string; label: string }> = {
  '夯':    { bg: '#CC0000', color: '#FFFFFF', label: '🔥 夯' },
  '顶级':  { bg: '#FF8C00', color: '#FFFFFF', label: '⚡ 顶级' },
  '人上人':{ bg: '#FFD700', color: '#1a1a1a', label: '✨ 人上人' },
  'NPC':   { bg: '#F5E6C8', color: '#555555', label: '😐 NPC' },
  '拉完了':{ bg: '#F0F0F0', color: '#888888', label: '💩 拉完了' },
};

function getBeijingDate(date: Date): { month: number; day: number } {
  const bjDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return { month: bjDate.getUTCMonth() + 1, day: bjDate.getUTCDate() };
}

function buildEmailHtml(repos: ReviewedRepo[], date: Date, unsubscribeUrl?: string): string {
  const { month, day } = getBeijingDate(date);
  const grouped = new Map<Tier, ReviewedRepo[]>();
  for (const tier of TIER_ORDER) grouped.set(tier, []);
  for (const repo of repos) {
    grouped.get(repo.tier)?.push(repo);
  }

  const tierSections = TIER_ORDER.map((tier) => {
    const style = TIER_STYLE[tier];
    const items = grouped.get(tier) ?? [];

    const itemsHtml =
      items.length === 0
        ? `<p style="margin:8px 0 0 0;color:#aaa;font-size:14px;">本周无</p>`
        : items
            .map(
              (r) => `
      <div style="border-bottom:1px solid #e8e8e8;padding:14px 0;">
        <p style="margin:0 0 4px 0;font-size:15px;font-weight:600;color:#1a1a1a;">
          <a href="${r.url}" style="color:#333;text-decoration:none;">${r.name}</a>
          <span style="font-size:12px;font-weight:400;color:#888;margin-left:8px;">
            技术 ${r.tech_score}/5 &nbsp;·&nbsp; 场景 ${r.scene_score}/5
          </span>
        </p>
        <p style="margin:0 0 6px 0;font-size:14px;color:#444;line-height:1.6;">${r.summary}</p>
        <a href="${r.url}" style="font-size:13px;color:#E05A00;text-decoration:none;font-weight:500;">
          有点意思，给我也整一个！→ ${r.url}
        </a>
      </div>`
            )
            .join('');

    return `
    <div style="margin-bottom:28px;">
      <div style="background:${style.bg};color:${style.color};padding:10px 18px;border-radius:6px 6px 0 0;font-size:17px;font-weight:700;letter-spacing:1px;">
        ${style.label}
      </div>
      <div style="background:#fff;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 6px 6px;padding:4px 18px 10px;">
        ${itemsHtml}
      </div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
    <div style="background:#1a1a1a;padding:24px 28px;">
      <p style="margin:0 0 4px 0;font-size:11px;color:#888;letter-spacing:2px;text-transform:uppercase;">Crow's Pick in GitHub</p>
      <h1 style="margin:0;font-size:20px;color:#fff;font-weight:700;line-height:1.3;">
        鸦速通本周 GH 热榜<br>
        <span style="color:#FF8C00;">${month}/${day}</span> 在火什么玩意
      </h1>
    </div>
    <div style="padding:24px 28px 8px;">
      ${tierSections}
    </div>
    <div style="padding:16px 28px 24px;border-top:1px solid #f0f0f0;">
      <p style="margin:0 0 6px 0;font-size:12px;color:#bbb;text-align:center;">
        由 <a href="https://github.com/trending" style="color:#bbb;">GitHub Trending</a> 自动聚合 · 这是啥？周报
      </p>
      ${unsubscribeUrl ? `<p style="margin:0;font-size:11px;color:#ccc;text-align:center;"><a href="${unsubscribeUrl}" style="color:#ccc;">退订</a></p>` : ''}
    </div>
  </div>
</body>
</html>`;
}

export async function sendWeeklyDigest(
  repos: ReviewedRepo[],
  to: string,
  unsubscribeUrl?: string
): Promise<void> {
  const date = new Date();
  const { month, day } = getBeijingDate(date);
  const subject = `鸦速通本周 GH 热榜｜${month}/${day} 在火什么玩意？ | Crow's Pick in GitHub`;
  const html = buildEmailHtml(repos, date, unsubscribeUrl);
  await sendMail(to, subject, html);
}

// ─── Welcome email ────────────────────────────────────────────────────────────

function buildWelcomeEmailHtml(unsubscribeUrl: string): string {
  return `<!DOCTYPE html>
<html lang="zh">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
    <div style="background:#1a1a1a;padding:24px 28px;">
      <p style="margin:0 0 4px 0;font-size:11px;color:#888;letter-spacing:2px;text-transform:uppercase;">Crow's Pick in GitHub</p>
      <h1 style="margin:0;font-size:20px;color:#fff;font-weight:700;">订阅成功 ✓</h1>
    </div>
    <div style="padding:28px 28px 8px;">
      <p style="margin:0 0 16px 0;font-size:16px;color:#1a1a1a;line-height:1.6;">
        你已加入 <strong>GitHub 周报「速通热榜」</strong> 的订阅列表。
      </p>
      <div style="background:#f9f9f9;border-left:4px solid #FF8C00;border-radius:0 6px 6px 0;padding:14px 18px;margin-bottom:20px;">
        <p style="margin:0 0 8px 0;font-size:14px;color:#555;font-weight:600;">你会收到什么？</p>
        <p style="margin:0;font-size:14px;color:#666;line-height:1.7;">
          每周 GitHub Trending 热榜 Top 20，AI 五档评审：<br>
          🔥 夯 &nbsp;·&nbsp; ⚡ 顶级 &nbsp;·&nbsp; ✨ 人上人 &nbsp;·&nbsp; 😐 NPC &nbsp;·&nbsp; 💩 拉完了
        </p>
      </div>
      <div style="background:#f9f9f9;border-left:4px solid #1a1a1a;border-radius:0 6px 6px 0;padding:14px 18px;margin-bottom:20px;">
        <p style="margin:0 0 4px 0;font-size:14px;color:#555;font-weight:600;">什么时候发？</p>
        <p style="margin:0;font-size:14px;color:#666;">每周一 17:00（北京时间）</p>
      </div>
    </div>
    <div style="padding:16px 28px 24px;border-top:1px solid #f0f0f0;">
      <p style="margin:0;font-size:11px;color:#ccc;text-align:center;">
        不想收了？<a href="${unsubscribeUrl}" style="color:#ccc;">退订</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendWelcomeEmail(to: string, unsubscribeUrl: string): Promise<void> {
  await sendMail(to, '已订阅 | GitHub 周报「速通热榜」确认', buildWelcomeEmailHtml(unsubscribeUrl));
}

function buildReactivationEmailHtml(unsubscribeUrl: string): string {
  return `<!DOCTYPE html>
<html lang="zh">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
    <div style="background:#1a1a1a;padding:24px 28px;">
      <p style="margin:0 0 4px 0;font-size:11px;color:#888;letter-spacing:2px;text-transform:uppercase;">Crow's Pick in GitHub</p>
      <h1 style="margin:0;font-size:20px;color:#fff;font-weight:700;">欢迎回来 👋</h1>
    </div>
    <div style="padding:28px 28px 8px;">
      <p style="margin:0 0 16px 0;font-size:16px;color:#1a1a1a;line-height:1.6;">
        你已重新加入 <strong>GitHub 周报「速通热榜」</strong> 的订阅列表。
      </p>
      <div style="background:#f9f9f9;border-left:4px solid #FF8C00;border-radius:0 6px 6px 0;padding:14px 18px;margin-bottom:20px;">
        <p style="margin:0;font-size:14px;color:#666;line-height:1.7;">
          每周一 17:00（北京时间），GitHub Trending Top 20 + AI 五档评审准时到达。
        </p>
      </div>
    </div>
    <div style="padding:16px 28px 24px;border-top:1px solid #f0f0f0;">
      <p style="margin:0;font-size:11px;color:#ccc;text-align:center;">
        不想收了？<a href="${unsubscribeUrl}" style="color:#ccc;">退订</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendReactivationEmail(to: string, unsubscribeUrl: string): Promise<void> {
  await sendMail(to, '欢迎回来 | 已重新加入 GitHub 周报', buildReactivationEmailHtml(unsubscribeUrl));
}

// ─── Unsubscribe confirmation email ──────────────────────────────────────────

function buildUnsubscribeConfirmHtml(resubscribeUrl: string): string {
  return `<!DOCTYPE html>
<html lang="zh">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:48px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);text-align:center;padding:40px 32px;">
    <p style="margin:0 0 8px 0;font-size:32px;">👋</p>
    <h1 style="margin:0 0 12px 0;font-size:20px;color:#1a1a1a;font-weight:700;">已退订</h1>
    <p style="margin:0 0 24px 0;font-size:15px;color:#666;line-height:1.6;">
      你已成功退订 GitHub 周报「速通热榜」。<br>以后不会再打扰你了。
    </p>
    <a href="${resubscribeUrl}" style="font-size:13px;color:#aaa;text-decoration:underline;">误操作了？点此重新订阅</a>
  </div>
</body>
</html>`;
}

export async function sendUnsubscribeConfirmEmail(to: string, resubscribeUrl: string): Promise<void> {
  await sendMail(to, '已退订 | 你不会再收到 GitHub 周报', buildUnsubscribeConfirmHtml(resubscribeUrl));
}
