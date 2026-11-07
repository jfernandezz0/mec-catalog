import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const db = getSupabaseAdmin();
  try {
    const raw = (await request.json()) as { articleIds?: unknown };
    const articleIds = Array.isArray(raw?.articleIds) ? raw.articleIds : [];

    const sanitizedIds = Array.from(
      new Set(
        articleIds
          .map(Number)
          .filter((id) => Number.isInteger(id) && id > 0)
      )
    ).slice(0, 50);

    if (sanitizedIds.length === 0) {
      return NextResponse.json({ error: 'Valid articleIds array required (max 50)' }, { status: 400 });
    }

    const { error } = await db
      .from('articles')
      .update({ reserved_until: null })
      .in('id', sanitizedIds);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[release-stock]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
