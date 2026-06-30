'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/lib/contexts/CartContext';
import { formatPrice } from '@/lib/utils';
import { usePathname } from 'next/navigation';

export default function CartDrawer() {
  const pathname = usePathname();

  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/invoice')
  ) {
    return null;
  }

  const {
    items,
    total,
    itemCount,
    stockStatuses,
    isDrawerOpen,
    closeDrawer,
    removeItem,
    validateStock,
  } = useCart();

  // Validate stock whenever the drawer opens
  useEffect(() => {
    if (isDrawerOpen) {
      validateStock();
    }
  }, [isDrawerOpen, validateStock]);

  // Lock body scroll while open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  const getStatus = (articleId: number) =>
    stockStatuses.find(s => s.articleId === articleId);

  const hasUnavailableItems = stockStatuses.some(s => !s.available);

  const availableTotal = items
    .filter(item => {
      const status = getStatus(item.article.id);
      return !status || status.available;
    })
    .reduce((sum, i) => sum + (i.priceAtAdd * (i.quantity || 1)), 0);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={closeDrawer}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 1050,
          opacity: isDrawerOpen ? 1 : 0,
          pointerEvents: isDrawerOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Drawer panel */}
      <aside
        id="cart-drawer"
        aria-label="Carrito de compra"
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(420px, 100vw)',
          background: 'var(--bg-card, #1a1a1a)',
          borderLeft: '1px solid var(--border-card, rgba(255,255,255,0.08))',
          zIndex: 1100,
          display: 'flex',
          flexDirection: 'column',
          transform: isDrawerOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isDrawerOpen ? '-8px 0 40px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 20px 16px',
            borderBottom: '1px solid var(--border-card, rgba(255,255,255,0.08))',
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            🛒 Tu carrito
            {itemCount > 0 && (
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 400,
                  color: 'var(--text-secondary)',
                }}
              >
                ({itemCount} {itemCount === 1 ? 'artículo' : 'artículos'})
              </span>
            )}
          </h2>
          <button
            id="cart-drawer-close"
            onClick={closeDrawer}
            aria-label="Cerrar carrito"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 0.15s',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Items list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {items.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 0',
                color: 'var(--text-secondary)',
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛒</div>
              <p style={{ margin: 0, fontSize: '15px' }}>Tu carrito está vacío</p>
              <p style={{ margin: '8px 0 0', fontSize: '13px', opacity: 0.7 }}>
                Añade artículos desde el catálogo
              </p>
            </div>
          ) : (
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {items.map(item => {
                const status = getStatus(item.article.id);
                const isUnavailable = !!status && !status.available;
                const imageUrl = item.article.image_urls?.[0];

                return (
                  <li
                    key={item.article.id}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                      padding: '12px',
                      borderRadius: '10px',
                      background: isUnavailable
                        ? 'rgba(239,68,68,0.08)'
                        : 'var(--bg-card-glass, rgba(255,255,255,0.04))',
                      border: `1px solid ${
                        isUnavailable
                          ? 'rgba(239,68,68,0.3)'
                          : 'var(--border-card, rgba(255,255,255,0.06))'
                      }`,
                      opacity: isUnavailable ? 0.75 : 1,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    {/* Thumbnail */}
                    <div
                      style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        flexShrink: 0,
                        background: 'var(--bg-page)',
                      }}
                    >
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={item.article.title}
                          width={64}
                          height={64}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '28px',
                          }}
                        >
                          🚗
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link
                        href={`/article/${item.article.id}`}
                        onClick={closeDrawer}
                        style={{
                          textDecoration: 'none',
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                          fontWeight: 600,
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.article.title}
                      </Link>
                      <span
                        style={{
                          fontSize: '15px',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          marginTop: '4px',
                          display: 'block',
                        }}
                      >
                        {formatPrice(item.priceAtAdd)}
                        {item.quantity > 1 && (
                          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '8px' }}>
                            x{item.quantity}
                          </span>
                        )}
                      </span>
                      {isUnavailable && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#ef4444',
                            marginTop: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          ❌ Ya no está disponible
                        </span>
                      )}
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => removeItem(item.article.id)}
                      aria-label={`Eliminar ${item.article.title} del carrito`}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        padding: '4px',
                        borderRadius: '6px',
                        flexShrink: 0,
                        transition: 'color 0.15s',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer: total + checkout */}
        {items.length > 0 && (
          <div
            style={{
              padding: '16px 20px 20px',
              borderTop: '1px solid var(--border-card, rgba(255,255,255,0.08))',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              flexShrink: 0,
            }}
          >
            {hasUnavailableItems && (
              <p
                style={{
                  margin: 0,
                  fontSize: '12px',
                  color: '#ef4444',
                  textAlign: 'center',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                }}
              >
                ⚠️ Algunos artículos ya no están disponibles. Elimínalos para continuar.
              </p>
            )}

            {/* Subtotal */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Subtotal (sin envío)
              </span>
              <span
                style={{
                  color: 'var(--text-primary)',
                  fontSize: '18px',
                  fontWeight: 700,
                }}
              >
                {formatPrice(availableTotal)}
              </span>
            </div>

            {/* Checkout button */}
            <Link
              id="cart-checkout-btn"
              href="/checkout"
              onClick={closeDrawer}
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '14px',
                borderRadius: '12px',
                background: hasUnavailableItems
                  ? 'rgba(99,102,241,0.3)'
                  : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '15px',
                textDecoration: 'none',
                cursor: hasUnavailableItems ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.15s, transform 0.15s',
                pointerEvents: hasUnavailableItems ? 'none' : 'auto',
              }}
            >
              Tramitar pedido →
            </Link>

            <p
              style={{
                margin: 0,
                fontSize: '11px',
                color: 'var(--text-secondary)',
                textAlign: 'center',
                opacity: 0.7,
              }}
            >
              Los gastos de envío se calculan al finalizar el pedido
            </p>
          </div>
        )}
      </aside>
    </>
  );
}
