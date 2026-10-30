import { ImageResponse } from 'next/og';
import { supabase } from '@/lib/supabase';
import { getFlagEmoji } from '@/lib/utils';

export const alt = 'MiniEngines Creations — Colección por País';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function CategoryOpenGraphImage({
  params,
}: {
  params: Promise<{ country: string }>;
}) {
  const { country } = await params;
  const countryCode = country.toUpperCase();

  // 1. Fetch category
  const { data: category } = await supabase
    .from('categories')
    .select('id, name, country_code')
    .ilike('country_code', countryCode)
    .maybeSingle();

  // 2. Fetch category articles with images
  let articlesCount = 0;
  let sampleImages: string[] = [];

  if (category) {
    const { data: articles, count } = await supabase
      .from('articles')
      .select('image_urls', { count: 'exact' })
      .eq('category_id', category.id)
      .eq('is_visible', true)
      .gt('quantity', 0)
      .limit(2);

    articlesCount = count ?? 0;
    if (articles) {
      sampleImages = articles
        .map((a: { image_urls: string[] | null }) => a.image_urls?.[0])
        .filter((url): url is string => Boolean(url));
    }
  }

  const categoryName = category?.name || countryCode;
  const flag = getFlagEmoji(category?.country_code || countryCode);
  const heroImage = sampleImages[0] || 'https://mec-catalog.vercel.app/logo.png';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '48px 56px',
          backgroundColor: '#070a12',
          backgroundImage:
            'radial-gradient(circle at 85% 20%, rgba(99, 102, 241, 0.25) 0%, transparent 55%), radial-gradient(circle at 15% 85%, rgba(0, 240, 255, 0.16) 0%, transparent 50%)',
          fontFamily: 'sans-serif',
          color: '#ffffff',
          position: 'relative',
        }}
      >
        {/* Decorative ambient border */}
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

        {/* LEFT COLUMN: Flag, Category Title, Stats */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '560px',
            height: '100%',
            padding: '12px 0',
            zIndex: 10,
          }}
        >
          {/* Header section */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Top Brand Line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#ff6b00',
                  boxShadow: '0 0 12px #ff6b00',
                }}
              />
              <span
                style={{
                  fontSize: '15px',
                  fontWeight: 800,
                  letterSpacing: '0.18em',
                  color: '#ff6b00',
                  textTransform: 'uppercase',
                }}
              >
                MiniEngines Creations
              </span>
            </div>

            {/* Country Flag & Label */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                marginTop: '28px',
              }}
            >
              <span style={{ fontSize: '56px' }}>{flag}</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em' }}>
                  COLECCIÓN DE ORIGEN
                </span>
                <span
                  style={{
                    fontSize: '52px',
                    fontWeight: 900,
                    color: '#ffffff',
                    lineHeight: 1.05,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {categoryName}
                </span>
              </div>
            </div>

            <div
              style={{
                fontSize: '20px',
                color: '#cbd5e1',
                marginTop: '20px',
                lineHeight: 1.4,
                maxWidth: '480px',
              }}
            >
              Modelos y creaciones de bloques artesanales inspirados en vehículos clásicos y deportivos de {categoryName}.
            </div>
          </div>

          {/* Footer stats section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 20px',
                  borderRadius: '14px',
                  backgroundColor: '#10b981',
                  color: '#070a12',
                  boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)',
                  fontSize: '18px',
                  fontWeight: 900,
                }}
              >
                <span>● {articlesCount} MODELOS DISPONIBLES</span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94a3b8',
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '0.08em',
              }}
            >
              <span>GARANTÍA DE ARTESANÍA Y CALIDAD</span>
              <span style={{ color: '#00f0ff' }}>mec-catalog.vercel.app/category/{country.toLowerCase()}</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Showcase Photo */}
        <div
          style={{
            display: 'flex',
            width: '490px',
            height: '490px',
            borderRadius: '22px',
            overflow: 'hidden',
            backgroundColor: '#0f172a',
            border: '1.5px solid rgba(255, 255, 255, 0.14)',
            boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.85), 0 0 30px rgba(99, 102, 241, 0.2)',
            position: 'relative',
            zIndex: 10,
          }}
        >
          <img
            src={heroImage}
            alt={categoryName}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
