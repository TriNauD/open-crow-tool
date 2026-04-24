import { NextRequest } from 'next/server';

export function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-secret');
  return !!secret && secret === process.env.ADMIN_SECRET;
}
