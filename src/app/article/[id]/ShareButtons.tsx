'use client';

import { useState, useEffect } from 'react';
import styles from './share.module.css';

type ShareButtonsProps = {
  title: string;
};

export default function ShareButtons({ title }: ShareButtonsProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  const shareUrl = mounted ? window.location.href : '';

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link: ', err);
    }
  };

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(`Mira este artículo en MiniEngines Creations: ${title}`);

  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`;
  const telegramShareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
  const emailShareUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodedText}%20${encodedUrl}`;

  return (
    <div className={styles.container}>
      <p className={styles.label}>Compartir artículo:</p>
      <div className={styles.buttons}>
        <a
          href={whatsappShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.shareBtn} ${styles.whatsappBtn}`}
          title="Compartir por WhatsApp"
        >
          <svg className={styles.icon} viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.46h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          <span>WhatsApp</span>
        </a>

        <a
          href={telegramShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.shareBtn} ${styles.telegramBtn}`}
          title="Compartir por Telegram"
        >
          <svg className={styles.icon} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-1-.65-.35-1 .22-1.6 1.5-1.55 2.75-2.92 2.86-3.44.02-.1-.01-.15-.07-.17-.06-.02-.15-.01-.22.01-.1.02-1.7 1.08-4.8 3.16-.45.31-.87.47-1.25.46-.42-.01-1.23-.24-1.83-.43-.74-.24-1.33-.37-1.28-.79.03-.22.33-.45.9-.69 3.53-1.53 5.88-2.54 7.07-3.03 3.37-1.4 4.07-1.64 4.53-1.65.1 0 .32.02.47.14.12.1.16.24.18.33.02.1.03.27.02.35z" />
          </svg>
          <span>Telegram</span>
        </a>

        <a
          href={emailShareUrl}
          className={`${styles.shareBtn} ${styles.emailBtn}`}
          title="Compartir por Email"
        >
          <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
          <span>Email</span>
        </a>

        <button
          onClick={handleCopy}
          className={`${styles.shareBtn} ${styles.copyBtn} ${copied ? styles.copiedBtn : ''}`}
          title={copied ? 'Enlace copiado' : 'Copiar enlace al portapapeles (Ideal para mensajes directos)'}
        >
          {copied ? (
            <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          )}
          <span>{copied ? '¡Copiado!' : 'Copiar enlace'}</span>
        </button>
      </div>
    </div>
  );
}
