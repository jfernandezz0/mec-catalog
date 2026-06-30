'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Category, Article, ImportRow, AdminTab } from '@/lib/types';
import styles from '../admin.module.css';

interface CSVImportTabProps {
  categories: Category[];
  articles: Article[];
  loadArticles: () => Promise<void>;
  handleTabChange: (tab: AdminTab) => void;
}

export default function CSVImportTab({ categories, articles, loadArticles, handleTabChange }: CSVImportTabProps) {
  const [csvRows, setCsvRows] = useState<ImportRow[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvImportProgress, setCsvImportProgress] = useState(0);
  const [csvImportResults, setCsvImportResults] = useState<{ success: number; failed: number } | null>(null);
  const [csvDragOver, setCsvDragOver] = useState(false);
  const [csvImportMode, setCsvImportMode] = useState<'create' | 'update'>('create');

  function downloadTemplate() {
    const lines = [
      'categoria;marca;modelo;precio;cantidad;descripcion',
      'ALE;Porsche;911 GT3 RS;4500.00;1;Edición limitada 2023. Sin uso.',
      'ITA;Ferrari;F40;12000.00;1;',
      'ESP;SEAT;Ibiza Sport;350.50;2;Escala 1:18. Leve rozadura en el techo.',
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_importacion_mec.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function parseCSVText(text: string): ImportRow[] {
    const clean = text.replace(/^\uFEFF/, '').trim();
    const lines = clean.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    return lines.slice(1).map((line, index) => {
      const parts = line.split(';').map((p) => p.trim().replace(/^"|"$/g, ''));
      const [categoria = '', marca = '', modelo = '', precio = '', cantidad = '', descripcion = ''] = parts;
      const errors: string[] = [];
      if (!categoria.trim()) errors.push('Categoría vacía');
      if (!marca.trim()) errors.push('Marca vacía');
      if (!modelo.trim()) errors.push('Modelo vacío');
      if (!precio.trim()) {
        errors.push('Precio vacío');
      } else if (isNaN(Number(precio.replace(',', '.')))) {
        errors.push('Precio no válido');
      }
      if (!cantidad.trim()) {
        errors.push('Cantidad vacía');
      } else if (!Number.isInteger(Number(cantidad)) || Number(cantidad) < 0) {
        errors.push('Cantidad debe ser entero ≥ 0');
      }
      if (descripcion.length > 250) errors.push('Descripción > 250 caracteres');
      const cat = categories.find((c) => c.country_code.toUpperCase() === categoria.toUpperCase());
      if (categoria.trim() && !cat) errors.push(`Categoría "${categoria}" no encontrada`);
      return { rowIndex: index + 2, categoria, marca, modelo, precio, cantidad, descripcion, errors, categoryId: cat?.id ?? null };
    });
  }

  function handleCSVFile(file: File) {
    setCsvFileName(file.name);
    setCsvImportResults(null);
    setCsvImportProgress(0);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? '';
      setCsvRows(parseCSVText(text));
    };
    reader.readAsText(file, 'UTF-8');
  }

  async function handleImportCSV() {
    const validRows = csvRows.filter((r) => r.errors.length === 0 && r.categoryId !== null);
    if (validRows.length === 0) return;
    setCsvImporting(true);
    setCsvImportProgress(0);
    let success = 0;
    let failed = 0;
    for (const row of validRows) {
      const title = `${row.marca.trim()} – ${row.modelo.trim()}`;
      
      const existingArticle = csvImportMode === 'update' 
        ? articles.find((a) => a.category_id === row.categoryId && a.title.trim().toLowerCase() === title.toLowerCase())
        : null;

      if (existingArticle) {
        // Update existing article
        const { error } = await supabase
          .from('articles')
          .update({
            price: Number(row.precio.replace(',', '.')),
            quantity: Number(row.cantidad),
            description: row.descripcion.trim() || existingArticle.description,
          })
          .eq('id', existingArticle.id);
        if (error) { failed++; } else { success++; }
      } else {
        // Insert new article
        const { error } = await supabase.from('articles').insert({
          category_id: row.categoryId!,
          title: title,
          description: row.descripcion.trim() || null,
          price: Number(row.precio.replace(',', '.')),
          quantity: Number(row.cantidad),
          image_urls: [],
        });
        if (error) { failed++; } else { success++; }
      }
      setCsvImportProgress((p) => p + 1);
    }
    setCsvImportResults({ success, failed });
    setCsvImporting(false);
    if (success > 0) {
      await loadArticles();
      
      // Trigger background sync to Square for newly imported articles
      (async () => {
        try {
          const session = (await supabase.auth.getSession()).data.session;
          if (session?.access_token) {
            await fetch('/api/admin/sync-square-catalog', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`
              }
            });
          }
        } catch (syncErr) {
          console.error('[Square Auto Sync CSV] Failed:', syncErr);
        }
      })();
    }
  }

  return (
    <div className={styles.importSection}>
      {/* Instructions header */}
      <div className={styles.importHeader}>
        <div>
          <p className={styles.importInstructionText}>
            Formato esperado (separado por <code>;</code>):{' '}
            <code>categoria;marca;modelo;precio;cantidad;descripcion</code>
          </p>
          <p className={styles.importInstructionHint}>
            El código de categoría debe coincidir con el de la BD
            {categories.length > 0 && (
              <> (ej. <strong>{categories.slice(0, 4).map((c) => c.country_code).join(', ')}{categories.length > 4 ? '...' : ''}</strong>)</>                  )}. Las imágenes se añaden después desde la ficha de cada artículo.
          </p>
        </div>
        <button type="button" className={styles.secondaryButton} onClick={downloadTemplate}>
          ⬇ Plantilla CSV
        </button>
      </div>

      {/* Import Mode Selection */}
      <div className={styles.importModeCard}>
        <span className={styles.importModeTitle}>Modo de Importación:</span>
        <div className={styles.importModeOptions}>
          <label className={`${styles.importModeOption} ${csvImportMode === 'create' ? styles.importModeOptionActive : ''}`}>
            <input
              type="radio"
              name="csvImportMode"
              value="create"
              checked={csvImportMode === 'create'}
              onChange={() => setCsvImportMode('create')}
              className={styles.importModeRadio}
            />
            <div>
              <span className={styles.importModeLabel}>Crear nuevos artículos</span>
              <span className={styles.importModeSublabel}>Inserta todos los artículos del archivo CSV como nuevos artículos independientes en el catálogo.</span>
            </div>
          </label>
          <label className={`${styles.importModeOption} ${csvImportMode === 'update' ? styles.importModeOptionActive : ''}`}>
            <input
              type="radio"
              name="csvImportMode"
              value="update"
              checked={csvImportMode === 'update'}
              onChange={() => setCsvImportMode('update')}
              className={styles.importModeRadio}
            />
            <div>
              <span className={styles.importModeLabel}>Actualizar existentes (Upsert)</span>
              <span className={styles.importModeSublabel}>Si ya existe un artículo con la misma categoría, marca y modelo, actualiza su precio y cantidad. Si no, lo crea nuevo.</span>
            </div>
          </label>
        </div>
      </div>

      {/* Drop zone */}
      <label
        className={`${styles.importDropZone} ${csvDragOver ? styles.importDropZoneActive : ''}`}
        onDragOver={(e) => { e.preventDefault(); setCsvDragOver(true); }}
        onDragLeave={() => setCsvDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setCsvDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleCSVFile(file);
        }}
      >
        <span className={styles.importDropIcon}>&#128194;</span>
        <span className={styles.importDropText}>
          {csvFileName ? `📄 ${csvFileName}` : 'Arrastra tu CSV aquí o haz clic para seleccionar'}
        </span>
        <span className={styles.importDropHint}>Solo archivos .csv</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className={styles.fileInput}
          onChange={(e) => { const file = e.target.files?.[0]; if (file) handleCSVFile(file); }}
        />
      </label>

      {/* Preview table */}
      {csvRows.length > 0 && (
        <>
          <div className={styles.importSummary}>
            <span className={styles.importSummaryValid}>
              ✅ {csvRows.filter((r) => r.errors.length === 0).length} filas válidas
            </span>
            {csvRows.filter((r) => r.errors.length > 0).length > 0 && (
              <span className={styles.importSummaryError}>
                ❌ {csvRows.filter((r) => r.errors.length > 0).length} con errores (se saltarán)
              </span>
            )}
          </div>

          <div className={styles.importTableContainer}>
            <table className={styles.importTable}>
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Categoría</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Precio</th>
                  <th>Cant.</th>
                  <th>Descripción</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {csvRows.map((row) => (
                  <tr
                    key={row.rowIndex}
                    className={row.errors.length > 0 ? styles.importRowError : styles.importRowValid}
                  >
                    <td>{row.rowIndex}</td>
                    <td>{row.categoria || '—'}</td>
                    <td>{row.marca || '—'}</td>
                    <td>{row.modelo || '—'}</td>
                    <td>{row.precio || '—'}</td>
                    <td>{row.cantidad || '—'}</td>
                    <td className={styles.importDescCell}>
                      {row.descripcion || <em>vacío</em>}
                    </td>
                    <td>
                      {row.errors.length > 0 ? (
                        <span
                          className={styles.importErrorBadge}
                          title={row.errors.join(' · ')}
                        >
                          ✗ {row.errors[0]}
                        </span>
                      ) : (
                        <span className={styles.importValidBadge}>✓ OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {csvImportResults ? (
            <div className={styles.importResultBanner}>
              🎉 Importación completada:{' '}
              <strong>{csvImportResults.success} artículos creados</strong>
              {csvImportResults.failed > 0 && ` · ${csvImportResults.failed} fallaron`}.
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => handleTabChange('catalog')}
                style={{ marginLeft: '16px' }}
              >
                Ver catálogo
              </button>
            </div>
          ) : (
            <div className={styles.importActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={csvImporting}
                onClick={() => { setCsvRows([]); setCsvFileName(''); }}
              >
                Limpiar
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={csvImporting || csvRows.filter((r) => r.errors.length === 0).length === 0}
                onClick={handleImportCSV}
              >
                {csvImporting
                  ? `Importando… ${csvImportProgress}/${csvRows.filter((r) => r.errors.length === 0).length}`
                  : `Importar ${csvRows.filter((r) => r.errors.length === 0).length} artículo${csvRows.filter((r) => r.errors.length === 0).length === 1 ? '' : 's'}`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
