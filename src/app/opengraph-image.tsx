import { ImageResponse } from 'next/og';
import { supabase } from '@/lib/supabase';

export const alt = 'MiniEngines Creations — Catálogo Digital';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  // Fetch active categories and total count of available articles
  const [categoriesRes, articlesRes] = await Promise.all([
    supabase.from('categories').select('id, name, country_code').order('name'),
    supabase.from('articles').select('id', { count: 'exact', head: true }).eq('is_visible', true).gt('quantity', 0),
  ]);

  const categories = categoriesRes.data ?? [];
  const totalAvailable = articlesRes.count ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '60px 80px',
          backgroundColor: '#070a12',
          backgroundImage:
            'radial-gradient(circle at 50% 15%, rgba(99, 102, 241, 0.28) 0%, transparent 60%), radial-gradient(circle at 10% 85%, rgba(0, 240, 255, 0.16) 0%, transparent 45%), radial-gradient(circle at 90% 85%, rgba(255, 107, 0, 0.18) 0%, transparent 45%)',
          fontFamily: 'sans-serif',
          color: '#ffffff',
          position: 'relative',
        }}
      >
        {/* Ambient border framing */}
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: 24,
            right: 24,
            bottom: 24,
            borderRadius: 24,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
          }}
        />

        {/* TOP: Brand badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', zIndex: 10 }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#ff6b00',
              boxShadow: '0 0 16px #ff6b00',
            }}
          />
          <span
            style={{
              fontSize: '16px',
              fontWeight: 800,
              letterSpacing: '0.22em',
              color: '#ff6b00',
              textTransform: 'uppercase',
            }}
          >
            MiniEngines Creations
          </span>
        </div>

        {/* CENTER: Main Title and Slogan */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            maxWidth: '960px',
            zIndex: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: '60px',
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              color: '#ffffff',
              textAlign: 'center',
              textShadow: '0 4px 20px rgba(0,0,0,0.7)',
            }}
          >
            Garaje Digital de Miniaturas
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: '24px',
              color: '#94a3b8',
              marginTop: '16px',
              fontWeight: 500,
              textAlign: 'center',
              maxWidth: '820px',
            }}
          >
            Modelos y creaciones MOC de bloques hechos a mano · Ediciones exclusivas
          </div>

          {/* Highlights pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '32px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 20px',
                borderRadius: '100px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1.5px solid #10b981',
                color: '#10b981',
                fontSize: '16px',
                fontWeight: 800,
                letterSpacing: '0.04em',
              }}
            >
              <span>● {totalAvailable} MODELOS DISPONIBLES</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 20px',
                borderRadius: '100px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                color: '#e2e8f0',
                fontSize: '16px',
                fontWeight: 700,
              }}
            >
              <span>🌍 {categories.length} PAÍSES Y COLECCIONES</span>
            </div>
          </div>
        </div>

        {/* BOTTOM: Domain & Trust badges */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            paddingTop: '20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#64748b', fontWeight: 600 }}>
            <span>🚗 Envíos protegidos</span>
            <span>·</span>
            <span>💳 Pago seguro con tarjeta / Bizum</span>
            <span>·</span>
            <span>✨ Acabados artesanales</span>
          </div>
          <span style={{ fontSize: '15px', color: '#00f0ff', fontWeight: 800, letterSpacing: '0.05em' }}>
            mec-catalog.vercel.app
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
