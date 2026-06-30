'use client';

import { useState } from 'react';
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
  const [selectedQty, setSelectedQty] = useState(1);
  const [isCartHovered, setIsCartHovered] = useState(false);
  const [isCardHovered, setIsCardHovered] = useState(false);

  const handleAddToCart = () => {
    if (!inCart) addItem(article, selectedQty);
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
      {/* Quantity Selector: Only show if stock > 1 and not already in cart */}
      {article.quantity > 1 && !inCart && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px',
          marginBottom: '2px',
        }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Cantidad</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setSelectedQty(prev => Math.max(1, prev - 1))}
              disabled={selectedQty <= 1}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: 'none',
                background: 'rgba(255,255,255,0.06)',
                color: '#fff',
                fontSize: '16px',
                cursor: selectedQty <= 1 ? 'not-allowed' : 'pointer',
                opacity: selectedQty <= 1 ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s',
              }}
            >
              −
            </button>
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#fff', minWidth: '20px', textAlign: 'center' }}>
              {selectedQty}
            </span>
            <button
              onClick={() => setSelectedQty(prev => Math.min(article.quantity, prev + 1))}
              disabled={selectedQty >= article.quantity}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: 'none',
                background: 'rgba(255,255,255,0.06)',
                color: '#fff',
                fontSize: '16px',
                cursor: selectedQty >= article.quantity ? 'not-allowed' : 'pointer',
                opacity: selectedQty >= article.quantity ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s',
              }}
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Primary: Add to cart */}
      <button
        id={`add-to-cart-${article.id}`}
        onClick={handleAddToCart}
        onMouseEnter={() => setIsCartHovered(true)}
        onMouseLeave={() => setIsCartHovered(false)}
        style={{
          width: '100%',
          padding: '13px 20px',
          borderRadius: '10px',
          border: inCart ? '2px solid #6366f1' : '2px solid transparent',
          background: inCart
            ? (isCartHovered ? '#8b5cf6' : 'rgba(99,102,241,0.12)')
            : (isCartHovered ? 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'),
          color: inCart
            ? (isCartHovered ? '#fff' : '#6366f1')
            : '#fff',
          fontWeight: 700,
          fontSize: '15px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.25s ease',
          boxShadow: isCartHovered
            ? '0 0 15px rgba(139, 92, 246, 0.6)'
            : 'none',
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
          href={`${squareCheckoutUrl}&quantity=${selectedQty}`}
          onMouseEnter={() => setIsCardHovered(true)}
          onMouseLeave={() => setIsCardHovered(false)}
          style={{
            width: '100%',
            padding: '12px 20px',
            borderRadius: '10px',
            background: isCardHovered ? '#ef4444' : 'rgba(0,0,0,0.6)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '14px',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.25s ease',
            border: isCardHovered ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.15)',
            boxSizing: 'border-box',
            boxShadow: isCardHovered
              ? '0 0 15px rgba(239, 68, 68, 0.6)'
              : 'none',
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
