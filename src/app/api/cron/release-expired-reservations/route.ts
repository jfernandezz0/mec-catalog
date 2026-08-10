import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * Cron job: release expired stock reservations.
 * Configure in vercel.json to run every minute:
 *   { "crons": [{ "path": "/api/cron/release-expired-reservations", "schedule": "* * * * *" }] }
 *
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const secret = request.headers.get('x-cron-secret');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && process.env.NODE_ENV === 'production') {
    const isAuthorized =
      authHeader === `Bearer ${cronSecret}` || secret === cronSecret;
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const db = getSupabaseAdmin();

  // Perform a single batch update to release all expired stock reservations and return the updated IDs
  const { data: releasedArticles, error } = await db
    .from('articles')
    .update({ reserved_until: null })
    .not('reserved_until', 'is', null)
    .lt('reserved_until', new Date().toISOString())
    .select('id');

  if (error) {
    console.error('[cron] Error releasing expired reservations:', error);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  const releasedCount = releasedArticles?.length ?? 0;
  console.log(`[cron] Released ${releasedCount} expired reservations`);
  return NextResponse.json({ released: releasedCount });
}
