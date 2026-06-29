import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const db = getSupabaseAdmin();
  try {
    const { articleIds } = await request.json() as { articleIds: number[] };

    if (!Array.isArray(articleIds) || articleIds.length === 0) {
      return NextResponse.json({ error: 'articleIds required' }, { status: 400 });
    }

    await Promise.all(
      articleIds.map((id) =>
        db.from('articles').update({ reserved_until: null }).eq('id', id)
      )
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[release-stock]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
