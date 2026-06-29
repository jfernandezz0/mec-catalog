import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

async function tryReserveStock(articleId: number): Promise<boolean> {
  const db = getSupabaseAdmin();

  // Check article state
  const { data: article, error: fetchError } = await db
    .from('articles')
    .select('id, quantity, reserved_until')
    .eq('id', articleId)
    .single();

  if (fetchError) {
    console.error(`[reserve-stock] Fetch error for article ${articleId}:`, fetchError);
    return false;
  }

  if (!article || article.quantity <= 0) {
    console.log(`[reserve-stock] Article ${articleId} out of stock`);
    return false;
  }

  const now = new Date();
  const reservedUntil = article.reserved_until ? new Date(article.reserved_until) : null;
  if (reservedUntil && reservedUntil > now) {
    console.log(`[reserve-stock] Article ${articleId} already reserved until ${article.reserved_until}`);
    return false;
  }

  // Try RPC first (atomic)
  const { data: rpcResult, error: rpcError } = await db.rpc('reserve_article_stock', {
    p_article_id: articleId,
    p_minutes: 3,
  });

  if (!rpcError) {
    return rpcResult === true;
  }

  // Fallback: direct UPDATE (if RPC not available)
  console.warn(`[reserve-stock] RPC not available, using direct UPDATE. Error: ${rpcError.message}`);

  const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
  const { data, error: updateError } = await db
    .from('articles')
    .update({ reserved_until: expiresAt })
    .eq('id', articleId)
    .gt('quantity', 0)
    .select('id');

  if (updateError) {
    console.error(`[reserve-stock] Direct UPDATE error for article ${articleId}:`, updateError);
    return false;
  }

  return !!data && data.length > 0;
}

export async function POST(request: NextRequest) {
  try {
    const { articleIds } = (await request.json()) as { articleIds: number[] };

    if (!Array.isArray(articleIds) || articleIds.length === 0) {
      return NextResponse.json({ error: 'articleIds required' }, { status: 400 });
    }

    const results: { articleId: number; reserved: boolean }[] = [];
    for (const id of articleIds) {
      const reserved = await tryReserveStock(id);
      results.push({ articleId: id, reserved });
    }

    const allReserved = results.every((r) => r.reserved);
    return NextResponse.json({ success: allReserved, results });
  } catch (err) {
    console.error('[reserve-stock] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
