'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { WhatsAppIcon, TelegramIcon, InstagramIcon, EmailIcon, ShareIcon } from '@/app/components/Icons';
import ShareDropdown from '@/app/components/ShareDropdown';
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

  const shareUrl = mounted ? window.location.href : '';

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

  // Pre-filled texts
  const contactPhoneNumber = '34619148601';
  const contactEmail = 'minienginescreations@gmail.com';
  const defaultContactMessage = `Hola, estoy interesado en el artículo ${title}, ¿podrías darme mas información?`;

  // Contact Links
  const whatsappContactUrl = `https://wa.me/${contactPhoneNumber}?text=${encodeURIComponent(defaultContactMessage)}`;
  const telegramContactUrl = `https://t.me/+${contactPhoneNumber}`;
  const instagramContactUrl = 'https://www.instagram.com/minienginescreations?igsh=MWRkMXpwYXJma2ZmYw%3D%3D&utm_source=qr';
  const emailContactUrl = `mailto:${contactEmail}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(defaultContactMessage)}`;

  // Handle Telegram contact link (auto-copy message to clipboard first)
  const handleTelegramContactClick = (e: React.MouseEvent) => {
    e.preventDefault();
    registerClick();
    copyToClipboard(defaultContactMessage, '¡Mensaje copiado! Pégalo al abrirse Telegram.');
    setTimeout(() => {
      window.open(telegramContactUrl, '_blank', 'noopener,noreferrer');
    }, 800);
  };

  const copyToClipboard = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToastMsg(successMessage);
      setTimeout(() => setToastMsg(''), 2500);
    } catch (err) {
      console.error('Failed to copy to clipboard: ', err);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (mounted && navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: `Mira este artículo en MiniEngines Creations: ${title}`,
          url: shareUrl,
        });
        // Register share click
        await supabase.rpc('increment_share_clicks', { article_id: id });
      } catch (err) {
        console.log('Error sharing natively:', err);
      }
    } else {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.prompt}>
        ¿Te interesa este motor artesanal? Contáctame por cualquiera de estas vías para consultar dudas, coordinar envío o concretar detalles de compra.
      </div>
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
          <WhatsAppIcon className={styles.icon} />
        </a>

        {/* Telegram Contact */}
        <a
          href={telegramContactUrl}
          onClick={handleTelegramContactClick}
          className={`${styles.circleBtn} ${styles.telegramBtn}`}
          title="Consultar por Telegram"
        >
          <TelegramIcon className={styles.icon} />
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
          <InstagramIcon className={styles.icon} />
        </a>

        {/* Email Contact */}
        <a
          href={emailContactUrl}
          onClick={registerClick}
          className={`${styles.circleBtn} ${styles.emailBtn}`}
          title="Contacto por Email"
        >
          <EmailIcon className={styles.icon} />
        </a>

        {/* iOS Share Trigger Button */}
        <button
          onClick={handleShare}
          className={`${styles.circleBtn} ${styles.shareBtn} ${isOpen ? styles.shareBtnActive : ''}`}
          title="Compartir artículo"
          aria-expanded={isOpen}
        >
          <ShareIcon className={styles.icon} />
        </button>

        {/* Dropdown sharing panel */}
        <ShareDropdown
          id={id}
          title={title}
          url={shareUrl}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onCopySuccess={(msg) => setToastMsg(msg)}
          parentRef={containerRef}
          copyMessage="¡Enlace copiado al portapapeles!"
          classes={{
            dropdown: styles.dropdown,
            dropdownItem: styles.dropdownItem,
            itemWhatsapp: styles.itemWhatsapp,
            itemTelegram: styles.itemTelegram,
            itemEmail: styles.itemEmail,
            itemCopy: styles.itemCopy,
            iconSmall: styles.iconSmall,
          }}
        />
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
