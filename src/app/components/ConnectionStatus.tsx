'use client';

import { useEffect, useState } from 'react';
import { WifiIcon, WifiOffIcon } from '@/app/components/Icons';

export default function ConnectionStatus() {
  const [status, setStatus] = useState<'online' | 'offline' | 'reconnecting'>('online');

  useEffect(() => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline) {
      setTimeout(() => setStatus('offline'), 0);
    }

    let reloadTimeout: number;

    const handleOnline = () => {
      setStatus('reconnecting');
      reloadTimeout = window.setTimeout(() => {
        window.location.reload();
      }, 800);
    };

    const handleOffline = () => setStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearTimeout(reloadTimeout);
    };
  }, []);

  if (status === 'online') {
    return null;
  }

  const isOffline = status === 'offline';

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 py-3">
      <div
        className={`max-w-[calc(100%-2rem)] rounded-full border px-5 py-3 text-sm font-semibold shadow-lg flex items-center gap-2.5 transition-all duration-300 ${
          isOffline
            ? 'border-[#fca5a5] bg-[#fee2e2] text-[#991b1b] shadow-[#fde2e2]/70'
            : 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] shadow-[#dcfce7]/70'
        }`}
        role="status"
        aria-live="polite"
      >
        {isOffline ? (
          <>
            <WifiOffIcon className="w-4.5 h-4.5 text-[#b91c1c] animate-pulse" />
            <span>Conexión perdida. Comprueba tu red.</span>
          </>
        ) : (
          <>
            <WifiIcon className="w-4.5 h-4.5 text-[#166534]" />
            <span>Conexión restablecida. Recargando...</span>
          </>
        )}
      </div>
    </div>
  );
}
