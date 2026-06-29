import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncArticleToSquareCatalog } from '@/lib/square';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify admin authentication via Bearer token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No autorizado. Debes iniciar sesión como administrador.' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Sesión no válida o expirada. Por favor, inicia sesión de nuevo.' },
        { status: 401 }
      );
    }

    // 2. Fetch all active articles (quantity = 1) that do not have a square_catalog_item_id
    const db = getSupabaseAdmin();
    const { data: articles, error: fetchErr } = await db
      .from('articles')
      .select('id, title, description, price')
      .eq('quantity', 1)
      .is('square_catalog_item_id', null);

    if (fetchErr) {
      throw new Error(`Error al obtener artículos: ${fetchErr.message}`);
    }

    if (!articles || articles.length === 0) {
      return NextResponse.json({ success: true, syncedCount: 0, message: 'Todos los artículos ya están sincronizados.' });
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
