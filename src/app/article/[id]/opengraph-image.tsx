import { ImageResponse } from 'next/og';
import { supabase } from '@/lib/supabase';
import { getFlagEmoji, formatPrice } from '@/lib/utils';
import { calculateDiscount } from '@/lib/discounts';

export const alt = 'MiniEngines Creations — Artículo';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const articleId = Number(id);

  // 1. Fetch article with category details
  const { data: article } = await supabase
    .from('articles')
    .select('id, title, price, quantity, image_urls, discount_type, discount_value, category_id')
    .eq('id', articleId)
    .maybeSingle();

  // 2. Fetch category and settings if article exists
  let categoryName = 'Colección';
  let countryCode = '';
  let categoryDiscount: number | null | undefined = null;
  let generalDiscount = '';
  let hidePrices = false;

  if (article) {
    const [catRes, settingsRes] = await Promise.all([
      article.category_id
        ? supabase.from('categories').select('name, country_code, discount_percent').eq('id', article.category_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('settings').select('key, value'),
    ]);

    if (catRes.data) {
      categoryName = catRes.data.name;
      countryCode = catRes.data.country_code;
      categoryDiscount = catRes.data.discount_percent;
    }

    if (settingsRes.data) {
      const map = new Map(settingsRes.data.map((s: { key: string; value: string }) => [s.key, s.value]));
      hidePrices = map.get('hide_prices') === 'true';
      generalDiscount = map.get('general_discount_percent') || '';
    }
  }

  // Fallback defaults if article not found
  const title = article?.title || 'MiniEngines Creations';
  const flag = getFlagEmoji(countryCode);
  const heroImage = article?.image_urls?.[0] || 'https://mec-catalog.vercel.app/logo.png';
  const isAvailable = (article?.quantity ?? 0) > 0;
  const refCode = article ? `MEC-${String(article.id).padStart(4, '0')}` : 'MEC-CATALOG';

  const discountInfo = article
    ? calculateDiscount(
        Number(article.price),
        article.discount_type,
        article.discount_value,
        categoryDiscount,
        generalDiscount
      )
    : { originalPrice: 0, finalPrice: 0, discountAmount: 0, appliedSource: 'none' as const, discountType: 'none' as const, discountValue: 0 };

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
            'radial-gradient(circle at 85% 20%, rgba(99, 102, 241, 0.22) 0%, transparent 55%), radial-gradient(circle at 15% 85%, rgba(0, 240, 255, 0.15) 0%, transparent 50%)',
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

        {/* LEFT COLUMN: Brand, Category, Title, Price, Ref */}
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

            {/* Category / Origin Pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '16px',
                padding: '6px 14px',
                borderRadius: '100px',
                backgroundColor: 'rgba(255, 255, 255, 0.07)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                width: 'fit-content',
              }}
            >
              <span style={{ fontSize: '18px' }}>{flag}</span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#cbd5e1',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                {categoryName}
              </span>
            </div>

            {/* Article Title */}
            <div
              style={{
                display: 'flex',
                fontSize: title.length > 32 ? '36px' : '44px',
                fontWeight: 900,
                color: '#ffffff',
                lineHeight: 1.15,
                marginTop: '20px',
                letterSpacing: '-0.02em',
                textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              }}
            >
              {title}
            </div>
          </div>

          {/* Footer section (Price & Stock) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {!hidePrices && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 20px',
                    borderRadius: '14px',
                    backgroundColor: '#10b981',
                    color: '#070a12',
                    boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)',
                  }}
                >
                  <span style={{ fontSize: '28px', fontWeight: 900 }}>
                    {formatPrice(discountInfo.finalPrice)}
                  </span>
                  {discountInfo.discountAmount > 0 && (
                    <span
                      style={{
                        fontSize: '18px',
                        textDecoration: 'line-through',
                        color: 'rgba(7, 10, 18, 0.65)',
                        fontWeight: 700,
                      }}
                    >
                      {formatPrice(discountInfo.originalPrice)}
                    </span>
                  )}
                </div>
              )}

              {/* Availability badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '14px',
                  backgroundColor: isAvailable ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1.5px solid ${isAvailable ? '#10b981' : '#ef4444'}`,
                  color: isAvailable ? '#10b981' : '#ef4444',
                  fontSize: '15px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                <span>{isAvailable ? '● DISPONIBLE' : '✕ AGOTADO'}</span>
              </div>
            </div>

            {/* Reference & domain tagline */}
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
              <span>{refCode} · EDICIÓN LIMITADA</span>
              <span style={{ color: '#00f0ff' }}>mec-catalog.vercel.app</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Photo Showcase */}
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
            alt={title}
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
