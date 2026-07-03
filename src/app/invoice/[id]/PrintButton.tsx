'use client';

import { PrintIcon } from '@/app/components/Icons';
import styles from './invoice.module.css';

export default function PrintButton() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`${styles.actions} noPrint`}>
      <button 
        onClick={handlePrint} 
        className={`${styles.button} ${styles.primaryButton}`} 
        style={{ width: '100%', justifyContent: 'center' }}
      >
        <PrintIcon width="18" height="18" aria-hidden="true" />
        Descargar PDF / Imprimir
      </button>
    </div>
  );
}
