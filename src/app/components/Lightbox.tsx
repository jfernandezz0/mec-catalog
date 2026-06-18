'use client';

import Image from 'next/image';
import { useEffect, useState, useRef } from 'react';

type LightboxProps = {
  imageUrls: string[];
  initialIndex: number;
  onClose: () => void;
  title: string;
};

export default function Lightbox({ imageUrls, initialIndex, onClose, title }: LightboxProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const showPrevious = () => {
    setActiveIndex((prev) => (prev === 0 ? imageUrls.length - 1 : prev - 1));
  };

  const showNext = () => {
    setActiveIndex((prev) => (prev === imageUrls.length - 1 ? 0 : prev + 1));
  };

  // Keyboard navigation & lock body scroll
  useEffect(() => {
    // Lock scroll
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') showPrevious();
      if (e.key === 'ArrowRight') showNext();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [imageUrls.length]);

  // Mobile swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diffX = touchStartX.current - touchEndX.current;
    const threshold = 50; // swipe threshold in pixels

    if (diffX > threshold) {
      showNext();
    } else if (diffX < -threshold) {
      showPrevious();
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const currentUrl = imageUrls[activeIndex];
  const hasMultiple = imageUrls.length > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm select-none"
      onClick={onClose}
    >
      {/* Top bar (Title and Close button) */}
      <div
        className="absolute top-0 inset-x-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-medium truncate max-w-[70%]">
          {title} {hasMultiple && `(${activeIndex + 1}/${imageUrls.length})`}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          aria-label="Cerrar visor"
          title="Cerrar (Esc)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Main Image Container */}
      <div
        className="relative w-full h-[80vh] flex items-center justify-center px-4"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image or arrows area
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {currentUrl ? (
          <div className="relative w-full h-full max-w-4xl">
            <Image
              src={currentUrl}
              alt={`${title} fullscreen image ${activeIndex + 1}`}
              fill
              sizes="(max-width: 1024px) 100vw, 1024px"
              priority
              className="object-contain"
            />
          </div>
        ) : (
          <div className="text-white text-center font-semibold text-sm leading-relaxed max-w-sm">
            El fotógrafo se está tomando unos días libres.<br />
            🏖️☀️🍹
          </div>
        )}
      </div>

      {/* Navigational Arrows (Desktop Only) */}
      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              showPrevious();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 hidden md:flex items-center justify-center w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Imagen anterior"
            title="Anterior (Flecha izquierda)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              showNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex items-center justify-center w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Siguiente imagen"
            title="Siguiente (Flecha derecha)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
      )}

      {/* Bottom thumbnails / dots (Optional details) */}
      {hasMultiple && (
        <div className="absolute bottom-4 flex gap-2">
          {imageUrls.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex(idx);
              }}
              className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                idx === activeIndex ? 'bg-white scale-125' : 'bg-white/40'
              }`}
              aria-label={`Ir a imagen ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
