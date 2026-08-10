import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Mark as dynamic to ensure Next.js never caches this route
export const dynamic = 'force-dynamic';

/**
 * Supabase Keep-Alive Cron Endpoint
 *
 * Designed to prevent Supabase Free Tier projects from pausing after 7 days of inactivity.
 * Executes a minimal read query against the database and returns latency metrics.
 *
 * Can be called by:
 * 1. Vercel Cron (configured in vercel.json)
 * 2. GitHub Actions schedule
 * 3. External monitors (UptimeRobot, cron-job.org, BetterStack)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Optional secret verification if CRON_SECRET is provided and configured
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    const secretHeader = request.headers.get('x-cron-secret');

    // If caller provided credentials, validate them if CRON_SECRET is set
    if (cronSecret && (authHeader || secretHeader)) {
      const isAuthorized =
        authHeader === `Bearer ${cronSecret}` || secretHeader === cronSecret;
      if (!isAuthorized) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Perform a lightweight query to generate database activity on Supabase
    const { data, error } = await supabase
      .from('categories')
      .select('id')
      .limit(1);

    const latencyMs = Date.now() - startTime;

    if (error) {
      console.error('[keep-alive] Supabase query error:', error.message);
      return NextResponse.json(
        {
          status: 'error',
          supabase: 'disconnected',
          error: error.message,
          latencyMs,
          timestamp: new Date().toISOString(),
        },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    return NextResponse.json(
      {
        status: 'ok',
        service: 'mec-catalog-supabase-keep-alive',
        supabase: 'connected',
        recordsSampled: data ? data.length : 0,
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[keep-alive] Unexpected exception:', errorMessage);

    return NextResponse.json(
      {
        status: 'error',
        supabase: 'error',
        error: errorMessage,
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }
}
