'use client';

import React, { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { WhatsAppIcon, TelegramIcon, EmailIcon, CopyIcon } from './Icons';

interface ShareDropdownProps {
  id: number;
  title: string;
  url: string;
  isOpen: boolean;
  onClose: () => void;
  onCopySuccess: (msg: string) => void;
  parentRef: React.RefObject<HTMLElement | null>;
  copyMessage?: string;
  classes: {
    dropdown: string;
    dropdownItem: string;
    itemWhatsapp?: string;
    itemTelegram?: string;
    itemEmail?: string;
    itemCopy?: string;
    iconSmall?: string;
  };
}

export default function ShareDropdown({
  id,
  title,
  url,
  isOpen,
  onClose,
  onCopySuccess,
  parentRef,
  copyMessage = '¡Enlace copiado!',
  classes,
}: ShareDropdownProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (parentRef.current && !parentRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, parentRef]);

  if (!isOpen) return null;

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

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      onCopySuccess(copyMessage);
    } catch (err) {
      console.error('Failed to copy to clipboard: ', err);
    }
  };

  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(`Mira este artículo en MiniEngines Creations: ${title}`);

  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`;
  const telegramShareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
  const emailShareUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodedText}%20${encodedUrl}`;

  return (
    <div className={classes.dropdown}>
      {/* Share to WhatsApp */}
      <a
        href={whatsappShareUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          registerShareClick();
          onClose();
        }}
        className={`${classes.dropdownItem} ${classes.itemWhatsapp || ''}`}
      >
        <WhatsAppIcon className={classes.iconSmall} />
        <span>WhatsApp</span>
      </a>

      {/* Share to Telegram */}
      <a
        href={telegramShareUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          registerShareClick();
          onClose();
        }}
        className={`${classes.dropdownItem} ${classes.itemTelegram || ''}`}
      >
        <TelegramIcon className={classes.iconSmall} />
        <span>Telegram</span>
      </a>

      {/* Share to Email */}
      <a
        href={emailShareUrl}
        onClick={() => {
          registerShareClick();
          onClose();
        }}
        className={`${classes.dropdownItem} ${classes.itemEmail || ''}`}
      >
        <EmailIcon className={classes.iconSmall} />
        <span>Compartir por Correo</span>
      </a>

      {/* Copy Link to clipboard */}
      <button
        onClick={() => {
          registerShareClick();
          onClose();
          copyToClipboard();
        }}
        className={`${classes.dropdownItem} ${classes.itemCopy || ''}`}
      >
        <CopyIcon className={classes.iconSmall} />
        <span>Copiar enlace</span>
      </button>
    </div>
  );
}
