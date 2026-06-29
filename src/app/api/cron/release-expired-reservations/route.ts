import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { releaseStock } from '@/lib/orders';

/**
 * Cron job: release expired stock reservations.
 * Configure in vercel.json to run every minute:
 *   { "crons": [{ "path": "/api/cron/release-expired-reservations", "schedule": "* * * * *" }] }
 *
 * Protected by CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: expiredArticles, error } = await supabase
    .from('articles')
    .select('id')
    .not('reserved_until', 'is', null)
    .lt('reserved_until', new Date().toISOString());

  if (error) {
    console.error('[cron] Error fetching expired reservations:', error);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  if (!expiredArticles?.length) {
    return NextResponse.json({ released: 0 });
  }

  await Promise.all(expiredArticles.map((a) => releaseStock(a.id)));

  console.log(`[cron] Released ${expiredArticles.length} expired reservations`);
  return NextResponse.json({ released: expiredArticles.length });
}
