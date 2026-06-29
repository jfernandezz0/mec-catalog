'use client';

import { useCart } from '@/lib/contexts/CartContext';
import type { Article } from '@/lib/types';

interface AddToCartButtonProps {
  article: Article;
  squareEnabled?: boolean;
  squareCheckoutUrl?: string;
}

export default function AddToCartButton({
  article,
  squareEnabled,
  squareCheckoutUrl,
}: AddToCartButtonProps) {
  const { addItem, hasItem, openDrawer } = useCart();
  const inCart = hasItem(article.id);

  const handleAddToCart = () => {
    if (!inCart) addItem(article);
    openDrawer();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        marginTop: '4px',
      }}
    >
      {/* Primary: Add to cart */}
      <button
        id={`add-to-cart-${article.id}`}
        onClick={handleAddToCart}
        style={{
          width: '100%',
          padding: '13px 20px',
          borderRadius: '10px',
          border: inCart ? '2px solid #6366f1' : '2px solid transparent',
          background: inCart
            ? 'rgba(99,102,241,0.12)'
            : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          color: inCart ? '#6366f1' : '#fff',
          fontWeight: 700,
          fontSize: '15px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.2s ease',
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {inCart ? (
            // Checkmark when already in cart
            <>
              <polyline points="20 6 9 17 4 12" />
            </>
          ) : (
            // Cart icon
            <>
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </>
          )}
        </svg>
        {inCart ? 'Ver carrito' : 'Añadir al carrito'}
      </button>

      {/* Square card payment button (if enabled) */}
      {squareEnabled && squareCheckoutUrl && (
        <a
          id={`pay-square-${article.id}`}
          href={squareCheckoutUrl}
          style={{
            width: '100%',
            padding: '12px 20px',
            borderRadius: '10px',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '14px',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'opacity 0.2s',
            border: '1px solid rgba(255,255,255,0.15)',
            boxSizing: 'border-box',
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
            <rect width="20" height="14" x="2" y="5" rx="2" />
            <line x1="2" x2="22" y1="10" y2="10" />
          </svg>
          Pagar con tarjeta
        </a>
      )}
    </div>
  );
}
