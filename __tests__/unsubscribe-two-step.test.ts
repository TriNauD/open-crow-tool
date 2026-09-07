import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/unsubscribe/route';
import { cancelByToken, getSubscriberByToken } from '@/lib/db/subscribers';
import { sendUnsubscribeConfirmEmail } from '@/lib/email';

vi.mock('@/lib/db/subscribers', () => ({
  getSubscriberByToken: vi.fn(),
  cancelByToken: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  sendUnsubscribeConfirmEmail: vi.fn(),
}));

const mockedLookup = vi.mocked(getSubscriberByToken);
const mockedCancel = vi.mocked(cancelByToken);
const mockedConfirmEmail = vi.mocked(sendUnsubscribeConfirmEmail);

const SITE = 'https://site.example';

function getReq(url: string): Request {
  return new Request(url, { method: 'GET', redirect: 'manual' });
}

function postReq(
  url: string,
  init: { body?: BodyInit; contentType?: string; origin?: string } = {}
): Request {
  const headers: Record<string, string> = {};
  if (init.contentType) headers['content-type'] = init.contentType;
  if (init.origin) headers['origin'] = init.origin;
  return new Request(url, { method: 'POST', headers, body: init.body, redirect: 'manual' });
}

function locationOf(res: Response): string {
  return res.headers.get('location') ?? '';
}

beforeEach(() => {
  mockedLookup.mockReset();
  mockedCancel.mockReset();
  mockedConfirmEmail.mockReset().mockResolvedValue(undefined);
});

describe('GET /api/unsubscribe（两步退订第一步：只读）', () => {
  it('带有效 token：跳确认页，绝不改库', async () => {
    mockedLookup.mockResolvedValue({
      id: 'n1',
      email: 'w@gmail.com',
      status: 'active',
      unsubscribe_token: 'tok-1',
      subscribed_at: '',
      cancelled_at: null,
    });

    const res = await GET(getReq(`${SITE}/api/unsubscribe?token=tok-1`));

    expect(res.status).toBe(307);
    expect(locationOf(res)).toBe(`${SITE}/unsubscribe?token=tok-1`);
    expect(mockedLookup).toHaveBeenCalledWith('tok-1');
    expect(mockedCancel).not.toHaveBeenCalled();
  });

  it('无效 token：直接给 notfound 状态页', async () => {
    mockedLookup.mockResolvedValue(null);
    const res = await GET(getReq(`${SITE}/api/unsubscribe?token=dead`));
    expect(locationOf(res)).toBe(`${SITE}/unsubscribe?status=notfound`);
    expect(mockedCancel).not.toHaveBeenCalled();
  });

  it('缺 token：给 invalid 状态页，不查库', async () => {
    const res = await GET(getReq(`${SITE}/api/unsubscribe`));
    expect(locationOf(res)).toBe(`${SITE}/unsubscribe?status=invalid`);
    expect(mockedLookup).not.toHaveBeenCalled();
  });
});

describe('POST /api/unsubscribe（两步退订第二步：真正取消）', () => {
  it('表单提交有效 token：取消成功并发确认邮件，303 回成功页', async () => {
    mockedCancel.mockResolvedValue({ email: 'w@gmail.com' });

    const res = await POST(
      postReq(`${SITE}/api/unsubscribe`, {
        body: new URLSearchParams({ token: 'tok-1' }).toString(),
        contentType: 'application/x-www-form-urlencoded',
        origin: SITE,
      })
    );

    expect(res.status).toBe(303);
    expect(locationOf(res)).toBe(`${SITE}/unsubscribe?status=success`);
    expect(mockedCancel).toHaveBeenCalledWith('tok-1');
    expect(mockedConfirmEmail).toHaveBeenCalledWith('w@gmail.com', `${SITE}/subscribe`);
  });

  it('JSON 提交同样支持', async () => {
    mockedCancel.mockResolvedValue({ email: 'w@gmail.com' });
    const res = await POST(
      postReq(`${SITE}/api/unsubscribe`, {
        body: JSON.stringify({ token: 'tok-1' }),
        contentType: 'application/json',
        origin: SITE,
      })
    );
    expect(locationOf(res)).toBe(`${SITE}/unsubscribe?status=success`);
  });

  it('token 无效：notfound，不发确认邮件', async () => {
    mockedCancel.mockResolvedValue(null);
    const res = await POST(
      postReq(`${SITE}/api/unsubscribe`, {
        body: new URLSearchParams({ token: 'dead' }).toString(),
        contentType: 'application/x-www-form-urlencoded',
        origin: SITE,
      })
    );
    expect(locationOf(res)).toBe(`${SITE}/unsubscribe?status=notfound`);
    expect(mockedConfirmEmail).not.toHaveBeenCalled();
  });

  it('第三方 Origin 直接 403，不触碰数据库（纵深防御）', async () => {
    const res = await POST(
      postReq(`${SITE}/api/unsubscribe`, {
        body: new URLSearchParams({ token: 'tok-1' }).toString(),
        contentType: 'application/x-www-form-urlencoded',
        origin: 'https://evil.example',
      })
    );
    expect(res.status).toBe(403);
    expect(mockedCancel).not.toHaveBeenCalled();
  });

  it('缺 token：invalid，不查库', async () => {
    const res = await POST(
      postReq(`${SITE}/api/unsubscribe`, {
        body: new URLSearchParams({}).toString(),
        contentType: 'application/x-www-form-urlencoded',
        origin: SITE,
      })
    );
    expect(locationOf(res)).toBe(`${SITE}/unsubscribe?status=invalid`);
    expect(mockedCancel).not.toHaveBeenCalled();
  });
});
