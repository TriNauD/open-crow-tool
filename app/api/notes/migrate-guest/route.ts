import { NextRequest, NextResponse } from 'next/server';
import { createUserDbClient } from '@/lib/db/client';
import { getAccessTokenFromRequest, getRequestUser, unauthorizedResponse } from '@/lib/utils/auth';
import { isNotebookMultiUserEnabled } from '@/lib/config/notebook';
import { logNotebookMetric } from '@/lib/observability/notebook';
import { migrateGuestNotes, type GuestMigrationEntry } from '@/lib/db/notes';
import { corsHeaders, handleOptions } from '@/lib/utils/cors';

export function OPTIONS() {
  return handleOptions();
}

function normalizeGuestEntries(input: unknown): GuestMigrationEntry[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const parsed = input
    .map((entry) => {
      const row = entry as Partial<GuestMigrationEntry>;
      if (
        typeof row.clientNoteId !== 'string' ||
        typeof row.inputText !== 'string' ||
        typeof row.explanation !== 'string' ||
        typeof row.savedAt !== 'number'
      ) {
        return null;
      }

      const source: GuestMigrationEntry['source'] =
        row.source === 'chrome_extension' ? 'chrome_extension' : 'web';

      return {
        clientNoteId: row.clientNoteId,
        inputText: row.inputText,
        explanation: row.explanation,
        parentText: typeof row.parentText === 'string' ? row.parentText : undefined,
        source,
        savedAt: row.savedAt,
      } as GuestMigrationEntry;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return parsed;
}

export async function POST(req: NextRequest) {
  if (!isNotebookMultiUserEnabled()) {
    return NextResponse.json({ error: 'Notebook multi-user mode is temporarily disabled' }, { status: 503 });
  }

  try {
    const token = getAccessTokenFromRequest(req);
    const user = await getRequestUser(req);
    if (!token || !user) {
      logNotebookMetric('auth_failed', { endpoint: 'POST /api/notes/migrate-guest' });
      return unauthorizedResponse();
    }

    const body = await req.json();
    const entries = normalizeGuestEntries(body.entries);
    if (entries.length === 0) {
      return NextResponse.json({ data: { insertedCount: 0 } }, { headers: corsHeaders });
    }

    const insertedCount = await migrateGuestNotes(
      { db: createUserDbClient(token), userId: user.id },
      entries
    );

    logNotebookMetric('guest_migration_success', { insertedCount });
    return NextResponse.json({ data: { insertedCount } }, { headers: corsHeaders });
  } catch (err) {
    logNotebookMetric('guest_migration_failed');
    console.error('[POST /api/notes/migrate-guest]', err);
    return NextResponse.json({ error: '游客笔记迁移失败，请稍后重试' }, { status: 500 });
  }
}
