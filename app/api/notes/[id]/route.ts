import { NextRequest, NextResponse } from 'next/server';
import { createUserDbClient } from '@/lib/db/client';
import { getAccessTokenFromRequest, getRequestUser, unauthorizedResponse } from '@/lib/utils/auth';
import { isNotebookMultiUserEnabled } from '@/lib/config/notebook';
import { logNotebookMetric } from '@/lib/observability/notebook';
import { corsHeaders, handleOptions } from '@/lib/utils/cors';
import { deleteNote } from '@/lib/db/notes';

export function OPTIONS() {
  return handleOptions();
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isNotebookMultiUserEnabled()) {
    return NextResponse.json({ error: 'Notebook multi-user mode is temporarily disabled' }, { status: 503 });
  }

  const { id } = await params;

  try {
    const token = getAccessTokenFromRequest(req);
    const user = await getRequestUser(req);
    if (!token || !user) {
      logNotebookMetric('auth_failed', { endpoint: 'DELETE /api/notes/:id' });
      return unauthorizedResponse();
    }

    await deleteNote({ db: createUserDbClient(token), userId: user.id }, id);
    logNotebookMetric('request_success', { endpoint: 'DELETE /api/notes/:id', noteId: id });
    return NextResponse.json({ data: { id } }, { headers: corsHeaders });
  } catch (err) {
    logNotebookMetric('request_failed', { endpoint: 'DELETE /api/notes/:id', noteId: id });
    console.error('[DELETE /api/notes/:id]', err);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
