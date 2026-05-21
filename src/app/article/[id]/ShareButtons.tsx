'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './share.module.css';

type ShareButtonsProps = {
  id: number;
  title: string;
};

export default function ShareButtons({ id, title }: ShareButtonsProps) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const shareUrl = mounted ? window.location.href : '';

  // Copy helper
  const copyToClipboard = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToastMsg(successMessage);
      // Auto-clear toast after 2.5s
      setTimeout(() => setToastMsg(''), 2500);
    } catch (err) {
      console.error('Failed to copy to clipboard: ', err);
    }
  };

  // Safe click tracker
  const registerClick = async () => {
    try {
      const { error } = await supabase.rpc('increment_contact_clicks', { article_id: id });
      if (error) {
        console.error('Error incrementing click counter:', error);
      }
    } catch (err) {
      console.error('Error registering contact click:', err);
    }
  };

  // Safe share click tracker
  const registerShareClick = async () => {
    try {
      const { error } = await supabase.rpc('increment_share_clicks', { article_id: id });
      if (error) {
        console.error('Error incrementing share click counter:', error);
      }
    } catch (err) {
      console.error('Error registering share click:', err);
    }
  };

  // Pre-filled texts
  const contactPhoneNumber = '34619148601';
  const contactEmail = 'minienginescreations@gmail.com';
  const defaultContactMessage = `Hola, estoy interesado en el artículo ${title}, ¿podrías darme mas información?`;

  // Contact Links
  const whatsappContactUrl = `https://wa.me/${contactPhoneNumber}?text=${encodeURIComponent(defaultContactMessage)}`;
  const telegramContactUrl = `https://t.me/+${contactPhoneNumber}`;
  const instagramContactUrl = 'https://www.instagram.com/minienginescreations?igsh=MWRkMXpwYXJma2ZmYw%3D%3D&utm_source=qr';
  const emailContactUrl = `mailto:${contactEmail}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(defaultContactMessage)}`;

  // Share Links
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(`Mira este artículo en MiniEngines Creations: ${title}`);
  
  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`;
  const telegramShareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
  const emailShareUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodedText}%20${encodedUrl}`;

  // Handle Telegram contact link (auto-copy message to clipboard first)
  const handleTelegramContactClick = (e: React.MouseEvent) => {
    e.preventDefault();
    registerClick();
    copyToClipboard(defaultContactMessage, '¡Mensaje copiado! Pégalo al abrirse Telegram.');
    setTimeout(() => {
      window.open(telegramContactUrl, '_blank', 'noopener,noreferrer');
    }, 800);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <p className={styles.prompt}>
        Consulta disponibilidad del MOC de bloques.<br />
        Todos los artículos se recogen, debido a su fragilidad, si necesitas envío consúltanos.
      </p>
      
      <div className={styles.buttonRow}>
        {/* WhatsApp Contact */}
        <a
          href={whatsappContactUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={registerClick}
          className={`${styles.circleBtn} ${styles.whatsappBtn}`}
          title="Consultar por WhatsApp"
        >
          <svg className={styles.icon} viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.46h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </a>

        {/* Telegram Contact */}
        <a
          href={telegramContactUrl}
          onClick={handleTelegramContactClick}
          className={`${styles.circleBtn} ${styles.telegramBtn}`}
          title="Consultar por Telegram"
        >
          <svg className={styles.icon} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-1-.65-.35-1 .22-1.6 1.5-1.55 2.75-2.92 2.86-3.44.02-.1-.01-.15-.07-.17-.06-.02-.15-.01-.22.01-.1.02-1.7 1.08-4.8 3.16-.45.31-.87.47-1.25.46-.42-.01-1.23-.24-1.83-.43-.74-.24-1.33-.37-1.28-.79.03-.22.33-.45.9-.69 3.53-1.53 5.88-2.54 7.07-3.03 3.37-1.4 4.07-1.64 4.53-1.65.1 0 .32.02.47.14.12.1.16.24.18.33.02.1.03.27.02.35z" />
          </svg>
        </a>

        {/* Instagram Profile */}
        <a
          href={instagramContactUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={registerClick}
          className={`${styles.circleBtn} ${styles.instagramBtn}`}
          title="Contacto en Instagram"
        >
          <svg className={styles.icon} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
          </svg>
        </a>

        {/* Email Contact */}
        <a
          href={emailContactUrl}
          onClick={registerClick}
          className={`${styles.circleBtn} ${styles.emailBtn}`}
          title="Contacto por Email"
        >
          <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </a>

        {/* iOS Share Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`${styles.circleBtn} ${styles.shareBtn} ${isOpen ? styles.shareBtnActive : ''}`}
          title="Compartir artículo"
          aria-expanded={isOpen}
        >
          <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" x2="12" y1="2" y2="15" />
          </svg>
        </button>

        {/* Dropdown sharing panel */}
        {isOpen && (
          <div className={styles.dropdown}>
             {/* Share to WhatsApp */}
            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                registerShareClick();
                setIsOpen(false);
              }}
              className={`${styles.dropdownItem} ${styles.itemWhatsapp}`}
            >
              <svg className={styles.iconSmall} viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.46h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              <span>Compartir en WhatsApp</span>
            </a>

            {/* Share to Telegram */}
            <a
              href={telegramShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                registerShareClick();
                setIsOpen(false);
              }}
              className={`${styles.dropdownItem} ${styles.itemTelegram}`}
            >
              <svg className={styles.iconSmall} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-1-.65-.35-1 .22-1.6 1.5-1.55 2.75-2.92 2.86-3.44.02-.1-.01-.15-.07-.17-.06-.02-.15-.01-.22.01-.1.02-1.7 1.08-4.8 3.16-.45.31-.87.47-1.25.46-.42-.01-1.23-.24-1.83-.43-.74-.24-1.33-.37-1.28-.79.03-.22.33-.45.9-.69 3.53-1.53 5.88-2.54 7.07-3.03 3.37-1.4 4.07-1.64 4.53-1.65.1 0 .32.02.47.14.12.1.16.24.18.33.02.1.03.27.02.35z" />
              </svg>
              <span>Compartir en Telegram</span>
            </a>

            {/* Share to Email */}
            <a
              href={emailShareUrl}
              onClick={() => {
                registerShareClick();
                setIsOpen(false);
              }}
              className={`${styles.dropdownItem} ${styles.itemEmail}`}
            >
              <svg className={styles.iconSmall} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <span>Compartir por Correo</span>
            </a>

            {/* Copy Link to clipboard */}
            <button
              onClick={() => {
                registerShareClick();
                setIsOpen(false);
                copyToClipboard(shareUrl, '¡Enlace copiado al portapapeles!');
              }}
              className={`${styles.dropdownItem} ${styles.itemCopy}`}
            >
              <svg className={styles.iconSmall} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
              <span>Copiar enlace</span>
            </button>
          </div>
        )}
      </div>

      {/* Interactive Toast Alerts */}
      {toastMsg && (
        <div className={styles.toast} role="alert">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
