'use client';

import { useCart } from '@/lib/contexts/CartContext';
import { usePathname } from 'next/navigation';

export default function CartButton() {
  const { itemCount, openDrawer } = useCart();
  const pathname = usePathname();

  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/invoice')
  ) {
    return null;
  }

  return (
    <button
      id="cart-button"
      className="noPrint"
      onClick={openDrawer}
      aria-label={`Carrito de compra, ${itemCount} artículo${itemCount !== 1 ? 's' : ''}`}
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 1000,
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 24px rgba(99,102,241,0.45)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={e => {
        const btn = e.currentTarget;
        btn.style.transform = 'scale(1.1)';
        btn.style.boxShadow = '0 6px 32px rgba(99,102,241,0.6)';
      }}
      onMouseLeave={e => {
        const btn = e.currentTarget;
        btn.style.transform = 'scale(1)';
        btn.style.boxShadow = '0 4px 24px rgba(99,102,241,0.45)';
      }}
    >
      {/* Cart icon */}
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
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>

      {/* Badge */}
      {itemCount > 0 && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: '#ef4444',
            color: '#fff',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            fontSize: '11px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            border: '2px solid var(--bg-page, #171717)',
          }}
        >
          {itemCount > 9 ? '9+' : itemCount}
        </span>
      )}
    </button>
  );
}
