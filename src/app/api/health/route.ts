import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Public Health Check endpoint.
 * Returns the status of the Next.js service and Supabase connectivity.
 */
export async function GET() {
  const startTime = Date.now();

  try {
    const { error } = await supabase
      .from('categories')
      .select('id')
      .limit(1);

    const latencyMs = Date.now() - startTime;

    if (error) {
      return NextResponse.json(
        {
          status: 'degraded',
          supabase: 'disconnected',
          error: error.message,
          latencyMs,
          timestamp: new Date().toISOString(),
        },
        {
          status: 503,
          headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        }
      );
    }

    return NextResponse.json(
      {
        status: 'healthy',
        supabase: 'connected',
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      {
        status: 'unhealthy',
        supabase: 'error',
        error: errorMessage,
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      }
    );
  }
}
