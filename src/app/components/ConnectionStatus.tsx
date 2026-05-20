'use client';

import { useEffect, useState } from 'react';

export default function ConnectionStatus() {
  const [status, setStatus] = useState<'online' | 'offline' | 'reconnecting'>('online');

  useEffect(() => {
    setStatus(typeof navigator !== 'undefined' ? (navigator.onLine ? 'online' : 'offline') : 'online');

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

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 py-3">
      <div
        className="max-w-[calc(100%-2rem)] rounded-full border border-[#fca5a5] bg-[#fee2e2] px-4 py-3 text-sm font-semibold text-[#991b1b] shadow-lg shadow-[#fde2e2]/70"
        role="status"
        aria-live="polite"
      >
        {status === 'offline'
          ? 'Conexión perdida. Comprueba tu red.'
          : 'Conexión restablecida. Recargando...'}
      </div>
    </div>
  );
}
