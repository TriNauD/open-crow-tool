import { NextRequest, NextResponse } from 'next/server';
import { createUserDbClient } from '@/lib/db/client';
import { getAccessTokenFromRequest, getRequestUser, unauthorizedResponse } from '@/lib/utils/auth';
import { isNotebookMultiUserEnabled } from '@/lib/config/notebook';
import { logNotebookMetric } from '@/lib/observability/notebook';
import { corsHeaders, handleOptions } from '@/lib/utils/cors';
import { getNotes, saveNote, searchNotes } from '@/lib/db/notes';

export function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  if (!isNotebookMultiUserEnabled()) {
    return NextResponse.json({ error: 'Notebook multi-user mode is temporarily disabled' }, { status: 503 });
  }

  const q = req.nextUrl.searchParams.get('q');

  try {
    const token = getAccessTokenFromRequest(req);
    const user = await getRequestUser(req);
    if (!token || !user) {
      logNotebookMetric('auth_failed', { endpoint: 'GET /api/notes' });
      return unauthorizedResponse();
    }

    const ctx = { db: createUserDbClient(token), userId: user.id };
    const notes = q ? await searchNotes(ctx, q) : await getNotes(ctx);
    logNotebookMetric('request_success', { endpoint: 'GET /api/notes', count: notes.length });
    return NextResponse.json({ data: notes }, { headers: corsHeaders });
  } catch (err) {
    logNotebookMetric('request_failed', { endpoint: 'GET /api/notes' });
    console.error('[GET /api/notes]', err);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isNotebookMultiUserEnabled()) {
    return NextResponse.json({ error: 'Notebook multi-user mode is temporarily disabled' }, { status: 503 });
  }

  try {
    const token = getAccessTokenFromRequest(req);
    const user = await getRequestUser(req);
    if (!token || !user) {
      logNotebookMetric('auth_failed', { endpoint: 'POST /api/notes' });
      return unauthorizedResponse();
    }

    const body = await req.json();
    const { inputText, explanation, parentId, parentText, source, clientNoteId } = body;

    if (!inputText || !explanation) {
      return NextResponse.json({ error: 'inputText and explanation are required' }, { status: 400 });
    }

    const note = await saveNote(
      { db: createUserDbClient(token), userId: user.id },
      {
      inputText,
      explanation,
      parentId,
      parentText,
      source: source === 'chrome_extension' ? 'chrome_extension' : 'web',
      clientNoteId: typeof clientNoteId === 'string' ? clientNoteId : undefined,
    }
    );

    logNotebookMetric('request_success', { endpoint: 'POST /api/notes', noteId: note.id });
    return NextResponse.json({ data: note }, { status: 201, headers: corsHeaders });
  } catch (err) {
    logNotebookMetric('request_failed', { endpoint: 'POST /api/notes' });
    console.error('[POST /api/notes]', err);
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 });
  }
}
