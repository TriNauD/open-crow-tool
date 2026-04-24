import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/auth';
import { corsHeaders, handleOptions } from '@/lib/cors';
import { getNotes, saveNote, searchNotes } from '@/lib/storage';

export function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get('q');

  try {
    const notes = q ? await searchNotes(q) : await getNotes();
    return NextResponse.json({ data: notes }, { headers: corsHeaders });
  } catch (err) {
    console.error('[GET /api/notes]', err);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { inputText, explanation, parentId, parentText } = body;

    if (!inputText || !explanation) {
      return NextResponse.json({ error: 'inputText and explanation are required' }, { status: 400 });
    }

    const note = await saveNote({
      inputText,
      explanation,
      parentId,
      parentText,
      source: 'chrome_extension',
    });

    return NextResponse.json({ data: note }, { status: 201, headers: corsHeaders });
  } catch (err) {
    console.error('[POST /api/notes]', err);
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 });
  }
}
