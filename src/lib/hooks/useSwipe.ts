import { useRef } from 'react';

export interface SwipeConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 50 }: SwipeConfig) {
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const swipeOccurred = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
    swipeOccurred.current = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const onTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diffX = touchStartX.current - touchEndX.current;

    if (Math.abs(diffX) > threshold) {
      swipeOccurred.current = true;
      if (diffX > 0) {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
      setTimeout(() => {
        swipeOccurred.current = false;
      }, 300);
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    swipeOccurred,
  };
}
