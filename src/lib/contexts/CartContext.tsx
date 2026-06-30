'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Article, CartItem, CartStockStatus } from '@/lib/types';

const CART_STORAGE_KEY = 'mec_cart';

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  total: number;
  stockStatuses: CartStockStatus[];
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addItem: (article: Article) => void;
  removeItem: (articleId: number) => void;
  clearCart: () => void;
  hasItem: (articleId: number) => boolean;
  validateStock: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [stockStatuses, setStockStatuses] = useState<CartStockStatus[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CartItem[];
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch {
      // ignore parse errors
    }
    setHydrated(true);
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore storage errors
    }
  }, [items, hydrated]);

  // Realtime subscription to stock changes of items in cart
  useEffect(() => {
    if (!hydrated || items.length === 0) return;

    const ids = items.map(i => i.article.id);

    const channel = supabase
      .channel('cart-stock-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'articles',
        },
        (payload) => {
          const updatedArticle = payload.new as { id: number; quantity: number; reserved_until?: string | null };
          if (ids.includes(updatedArticle.id)) {
            const now = new Date();
            const isAvailable =
              updatedArticle.quantity > 0 &&
              (!updatedArticle.reserved_until || new Date(updatedArticle.reserved_until) < now);

            setStockStatuses(prev => {
              const existing = prev.find(s => s.articleId === updatedArticle.id);
              if (existing && existing.available === isAvailable) return prev;

              const filtered = prev.filter(s => s.articleId !== updatedArticle.id);
              return [...filtered, { articleId: updatedArticle.id, available: isAvailable }];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [items, hydrated]);

  const addItem = useCallback((article: Article) => {
    setItems(prev => {
      if (prev.some(i => i.article.id === article.id)) return prev; // already in cart
      if (article.quantity <= 0) return prev; // out of stock
      const priceAtAdd = typeof article.price === 'string'
        ? parseFloat(article.price as unknown as string)
        : article.price;
      return [...prev, { article, priceAtAdd }];
    });
  }, []);

  const removeItem = useCallback((articleId: number) => {
    setItems(prev => prev.filter(i => i.article.id !== articleId));
    setStockStatuses(prev => prev.filter(s => s.articleId !== articleId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setStockStatuses([]);
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('mec_reservation');
      }
    } catch {}
  }, []);

  const hasItem = useCallback((articleId: number) => {
    return items.some(i => i.article.id === articleId);
  }, [items]);

  const validateStock = useCallback(async () => {
    if (items.length === 0) {
      setStockStatuses([]);
      return;
    }
    try {
      const ids = items.map(i => i.article.id);

      // Try with reserved_until first, fall back if column doesn't exist
      let data: { id: number; quantity: number; reserved_until?: string | null }[] | null = null;

      const res = await supabase
        .from('articles')
        .select('id, quantity, reserved_until')
        .in('id', ids);

      if (res.error?.message?.includes('reserved_until')) {
        // Column not yet migrated — fallback
        const fallback = await supabase
          .from('articles')
          .select('id, quantity')
          .in('id', ids);
        data = fallback.data;
      } else {
        data = res.data;
      }

      if (!data) return;

      const now = new Date();
      const statuses: CartStockStatus[] = data.map(row => {
        let locallyReserved = false;
        try {
          if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('mec_reservation');
            if (stored) {
              const { expiry, items: savedIds } = JSON.parse(stored);
              if (new Date(expiry) > now && savedIds.includes(row.id)) {
                locallyReserved = true;
              }
            }
          }
        } catch (e) {
          // Ignore storage errors
        }

        // Available if quantity > 1 (always), or quantity === 1 and either not reserved, expired, or reserved by this user
        const isAvailable = row.quantity > 1 || (row.quantity === 1 && (
          !row.reserved_until ||
          new Date(row.reserved_until) < now ||
          locallyReserved
        ));

        return {
          articleId: row.id,
          available: isAvailable,
        };
      });
      setStockStatuses(statuses);
    } catch {
      // Silent fail — don't block cart usage on network errors
    }
  }, [items]);

  const itemCount = items.length;
  const total = items.reduce((sum, i) => sum + i.priceAtAdd, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        total,
        stockStatuses,
        isDrawerOpen,
        openDrawer: () => setIsDrawerOpen(true),
        closeDrawer: () => setIsDrawerOpen(false),
        addItem,
        removeItem,
        clearCart,
        hasItem,
        validateStock,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
