import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/auth';
import { deleteNote } from '@/lib/storage';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await deleteNote(id);
    return NextResponse.json({ data: { id } });
  } catch (err) {
    console.error('[DELETE /api/notes/:id]', err);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
