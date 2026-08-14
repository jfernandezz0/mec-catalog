import { NextRequest, NextResponse } from 'next/server';
import { syncArticleToSquareCatalog } from '@/lib/square';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifyAdminSession } from '@/lib/utils.server';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify admin authentication
    const authResult = await verifyAdminSession(request);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }

    // 1.5. Check settings to verify if Square payments are enabled
    const db = getSupabaseAdmin();
    const { data: settings } = await db
      .from('settings')
      .select('key, value');

    const settingsMap = new Map(settings?.map((item: any) => [item.key, item.value]) || []);
    const squarePaymentsEnabled = settingsMap.get('square_payments_enabled') === 'true';
    const paymentsEnabled = settingsMap.get('payments_enabled') !== 'false';
    const hidePrices = settingsMap.get('hide_prices') === 'true';

    if (!squarePaymentsEnabled || !paymentsEnabled || hidePrices) {
      return NextResponse.json({
        success: true,
        syncedCount: 0,
        message: 'Sincronización de Square omitida porque está desactivada en la configuración.'
      });
    }

    // Try to parse optional articleId and force flag from body
    let articleId: number | null = null;
    let force = false;
    try {
      const body = await request.json();
      if (body) {
        if (typeof body.articleId === 'number') {
          articleId = body.articleId;
        }
        if (body.force === true) {
          force = true;
        }
      }
    } catch {
      // Ignore parse errors (e.g. empty or non-JSON body)
    }

    // 2. Fetch target articles
    let articles: any[] = [];
    let fetchErr = null;

    if (articleId) {
      const res = await db
        .from('articles')
        .select('id, title, description, price, image_urls, square_catalog_item_id')
        .eq('id', articleId)
        .single();
      if (res.data) {
        articles = [res.data];
      }
      fetchErr = res.error;
    } else if (force) {
      const res = await db
        .from('articles')
        .select('id, title, description, price, image_urls, square_catalog_item_id');
      if (res.data) {
        articles = res.data;
      }
      fetchErr = res.error;
    } else {
      const res = await db
        .from('articles')
        .select('id, title, description, price, image_urls, square_catalog_item_id')
        .is('square_catalog_item_id', null);
      if (res.data) {
        articles = res.data;
      }
      fetchErr = res.error;
    }

    if (fetchErr) {
      throw new Error(`Error al obtener artículos: ${fetchErr.message}`);
    }

    if (articles.length === 0) {
      return NextResponse.json({ success: true, syncedCount: 0, message: 'No hay artículos para sincronizar.' });
    }

    const syncedList: { id: number; title: string; square_catalog_item_id: string }[] = [];
    const failedList: { id: number; title: string; error: string }[] = [];

    // 3. Loop and sync each article
    for (const article of articles) {
      try {
        const variationId = await syncArticleToSquareCatalog(article);

        // Update in DB
        const { error: updateErr } = await db
          .from('articles')
          .update({ square_catalog_item_id: variationId })
          .eq('id', article.id);

        if (updateErr) {
          throw new Error(`Error al guardar id de catálogo en BD: ${updateErr.message}`);
        }

        syncedList.push({
          id: article.id,
          title: article.title,
          square_catalog_item_id: variationId,
        });
      } catch (err: any) {
        console.error(`[sync-catalog] Failed to sync article ${article.id}:`, err);
        failedList.push({
          id: article.id,
          title: article.title,
          error: err?.message || 'Error desconocido',
        });
      }
    }

    return NextResponse.json({
      success: true,
      syncedCount: syncedList.length,
      syncedList,
      failedCount: failedList.length,
      failedList,
    });
  } catch (error: any) {
    console.error('[sync-catalog] Critical error:', error);
    return NextResponse.json(
      { error: error?.message || 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
