import { NextRequest, NextResponse } from 'next/server';
import { createUserDbClient } from '@/lib/db/client';
import { getAccessTokenFromRequest, getRequestUser, unauthorizedResponse } from '@/lib/utils/auth';
import { isNotebookMultiUserEnabled } from '@/lib/config/notebook';
import { logNotebookMetric } from '@/lib/observability/notebook';
import { corsHeaders, handleOptions } from '@/lib/utils/cors';
import { deleteNote, updateNoteTags } from '@/lib/db/notes';
import { parseTagsInput } from '@/lib/notes/tags';

export function OPTIONS() {
  return handleOptions();
}

export async function PATCH(
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
      logNotebookMetric('auth_failed', { endpoint: 'PATCH /api/notes/:id' });
      return unauthorizedResponse();
    }

    const body = await req.json();
    if (!('tags' in body)) {
      return NextResponse.json({ error: 'tags is required' }, { status: 400 });
    }

    const tagsResult = parseTagsInput(body.tags);
    if (!tagsResult.ok) {
      return NextResponse.json({ error: tagsResult.error }, { status: 400 });
    }

    const note = await updateNoteTags(
      { db: createUserDbClient(token), userId: user.id },
      id,
      tagsResult.tags
    );
    logNotebookMetric('request_success', { endpoint: 'PATCH /api/notes/:id', noteId: id });
    return NextResponse.json({ data: note }, { headers: corsHeaders });
  } catch (err) {
    logNotebookMetric('request_failed', { endpoint: 'PATCH /api/notes/:id', noteId: id });
    console.error('[PATCH /api/notes/:id]', err);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
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
