'use client';

import { ChangeEvent, FormEvent } from 'react';
import Image from 'next/image';
import { FormState, Article, Category } from '@/lib/types';
import styles from '../admin.module.css';

interface ArticleFormProps {
  mode: 'create' | 'edit';
  formState: FormState;
  updateField: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  setFormState: React.Dispatch<React.SetStateAction<FormState>>;
  categories: Category[];
  loadingCategories: boolean;
  loading: boolean;
  hasDiscountColumns: boolean;
  generalDiscountPercent: string;
  // Files
  files: File[];
  frameFiles: File[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  frameFileInputRef: React.RefObject<HTMLInputElement | null>;
  updateFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  updateFrameFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  // Edit-specific
  editingArticle: Article | null;
  existingImageUrls: string[];
  existingFrameImageUrls: string[];
  handleDeleteExistingImage: (url: string) => void;
  handleDeleteExistingFrameImage: (url: string) => void;
  moveImage: (index: number, direction: 'left' | 'right') => void;
  moveFrameImage: (index: number, direction: 'left' | 'right') => void;
  // Actions
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
  onCancel: () => void;
  onReset: () => void;
}

export default function ArticleForm({
  mode,
  formState,
  updateField,
  setFormState,
  categories,
  loadingCategories,
  loading,
  hasDiscountColumns,
  generalDiscountPercent,
  files,
  frameFiles,
  fileInputRef,
  frameFileInputRef,
  updateFiles,
  updateFrameFiles,
  existingImageUrls,
  existingFrameImageUrls,
  handleDeleteExistingImage,
  handleDeleteExistingFrameImage,
  moveImage,
  moveFrameImage,
  onSubmit,
  onDelete,
  onCancel,
  onReset,
}: ArticleFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className={styles.form}
    >
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Ubicación</h2>

        <label className={styles.field}>
          <span className={styles.labelRow}>
            <span>Categoría (País)</span>
            <span className={styles.hint}>Requerido</span>
          </span>
          <select
            name="categoryId"
            value={formState.categoryId}
            onChange={updateField}
            required
            disabled={loadingCategories}
            className={styles.control}
          >
            <option value="">
              {loadingCategories ? 'Cargando categorías...' : 'Selecciona un país'}
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Detalles del artículo</h2>

        <label className={styles.field}>
          <span className={styles.labelRow}>
            <span>Marca</span>
            <span className={styles.hint}>{formState.marca.length}/40</span>
          </span>
          <input
            name="marca"
            value={formState.marca}
            onChange={updateField}
            maxLength={40}
            placeholder="Ej: Porsche, Ferrari, McLaren..."
            required
            disabled={loading}
            className={styles.control}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.labelRow}>
            <span>Modelo</span>
            <span className={styles.hint}>{formState.modelo.length}/60</span>
          </span>
          <input
            name="modelo"
            value={formState.modelo}
            onChange={updateField}
            maxLength={60}
            placeholder="Ej: 911 GT3 RS, F40, Senna..."
            required
            disabled={loading}
            className={styles.control}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.labelRow}>
            <span>Descripción</span>
            <span className={styles.hint}>{formState.description.length}/250</span>
          </span>
          <textarea
            name="description"
            value={formState.description}
            onChange={updateField}
            maxLength={250}
            rows={4}
            placeholder="Detalles sobre el estado, edición limitada, extras incluidos, etc."
            disabled={loading}
            className={styles.textarea}
          />
        </label>

        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.labelRow}>
              <span>Precio</span>
              <span className={styles.hint}>EUR</span>
            </span>
            <input
              name="price"
              value={formState.price}
              onChange={updateField}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              required
              disabled={loading}
              className={styles.control}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.labelRow}>
              <span>Cantidad</span>
              <span className={styles.hint}>Stock</span>
            </span>
            <input
              name="quantity"
              value={formState.quantity}
              onChange={updateField}
              type="number"
              min="0"
              step="1"
              required
              disabled={loading}
              className={styles.control}
            />
          </label>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Visibilidad</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
          <div>
            <span style={{ fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {formState.isVisible ? (
                <>
                  <span style={{ color: '#16a34a' }}>●</span> Visible en la web
                </>
              ) : (
                <>
                  <span style={{ color: '#dc2626' }}>●</span> Oculto en la web
                </>
              )}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
              {formState.isVisible
                ? 'Los usuarios de la web pueden ver y adquirir este artículo en el catálogo público.'
                : 'El artículo no aparecerá a los visitantes de la web ni en búsquedas, pero seguirá accesible en este panel de administración.'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setFormState((prev) => ({
                ...prev,
                isVisible: !prev.isVisible,
              }));
            }}
            className={`${styles.switch} ${formState.isVisible ? styles.switchActive : ''}`}
            title="Alternar visibilidad del artículo en la web"
            style={{ flexShrink: 0, marginLeft: '12px' }}
            disabled={loading}
          >
            <span className={styles.switchHandle} />
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Descuento</h2>
        {!hasDiscountColumns ? (
          <div className={styles.paymentsWarning} style={{ padding: '12px', margin: '0 0 16px 0' }}>
            <p style={{ margin: 0, fontSize: '13px' }}>
              ⚠️ Los descuentos de artículo están inhabilitados. Para usarlos, ejecuta la migración SQL en Supabase.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Active discount selector */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <div>
                <span style={{ fontWeight: '700', fontSize: '14px', display: 'block' }}>Activar descuento individual</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Aplica una rebaja exclusiva para este artículo.</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFormState(prev => ({
                    ...prev,
                    discountType: prev.discountType ? '' : 'percentage',
                    discountValue: prev.discountType ? '' : '10'
                  }));
                }}
                className={`${styles.switch} ${formState.discountType ? styles.switchActive : ''}`}
                title="Alternar descuento"
                style={{ flexShrink: 0, marginLeft: '12px' }}
              >
                <span className={styles.switchHandle} />
              </button>
            </div>

            {formState.discountType && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '3px solid var(--border-card)', paddingLeft: '16px' }}>
                <div className="flex gap-4">
                  <button
                    type="button"
                    className={`${styles.secondaryButton} ${formState.discountType === 'percentage' ? styles.primaryButton : ''}`}
                    style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px' }}
                    onClick={() => {
                      setFormState(prev => ({
                        ...prev,
                        discountType: 'percentage',
                        discountValue: prev.discountType === 'percentage' ? prev.discountValue : '10'
                      }));
                    }}
                  >
                    % Porcentaje
                  </button>
                  <button
                    type="button"
                    className={`${styles.secondaryButton} ${formState.discountType === 'amount' ? styles.primaryButton : ''}`}
                    style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px' }}
                    onClick={() => {
                      setFormState(prev => ({
                        ...prev,
                        discountType: 'amount',
                        discountValue: prev.discountType === 'amount' ? prev.discountValue : '5'
                      }));
                    }}
                  >
                    Importe Fijo
                  </button>
                </div>

                <label className={styles.field}>
                  <span className={styles.labelRow}>
                    <span>{formState.discountType === 'percentage' ? 'Porcentaje de descuento' : 'Importe a descontar (EUR)'}</span>
                    <span className={styles.hint}>
                      {formState.discountType === 'percentage' ? '1% a 100%' : `0.01€ a ${Number(formState.price) || 0}€`}
                    </span>
                  </span>
                  <input
                    type="number"
                    name="discountValue"
                    value={formState.discountValue}
                    onChange={updateField}
                    min={formState.discountType === 'percentage' ? "1" : "0.01"}
                    max={formState.discountType === 'percentage' ? "100" : formState.price || "99999"}
                    step={formState.discountType === 'percentage' ? "1" : "0.01"}
                    placeholder={formState.discountType === 'percentage' ? "Ej: 10" : "Ej: 5.50"}
                    required
                    disabled={loading}
                    className={styles.control}
                  />
                </label>
              </div>
            )}

            {/* Info about active discounts (if any) from category or general */}
            {(() => {
              const price = Number(formState.price) || 0;
              if (price <= 0) return null;
              const catId = Number(formState.categoryId);
              const category = categories.find(c => c.id === catId);
              const catPercent = category?.discount_percent || 0;
              const genPercent = Number(generalDiscountPercent) || 0;

              if (catPercent > 0 || genPercent > 0) {
                return (
                  <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-card-glass)', fontSize: '13px', border: '1px solid var(--border-card-glass)' }}>
                    <span style={{ fontWeight: '700', display: 'block', marginBottom: '4px' }}>Otros descuentos activos que podrían aplicar:</span>
                    <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'disc', color: 'var(--text-secondary)' }}>
                      {catPercent > 0 && (
                        <li>
                          Descuento de Categoría ({category?.name}): <strong>{catPercent}%</strong>
                        </li>
                      )}
                      {genPercent > 0 && (
                        <li>
                          Descuento General de la web: <strong>{genPercent}%</strong>
                        </li>
                      )}
                    </ul>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Imágenes</h2>

        <div className={styles.imageColumnsWrapper}>
          {/* Left column: Vehicle images */}
          <div className={styles.imageColumn}>
            <span className={styles.imageColumnTitle}>🚗 Vehículo</span>

            {/* Existing vehicle images (only in Edit mode) */}
            {mode === 'edit' && existingImageUrls.length > 0 && (
              <div className={styles.existingImages}>
                <span className={styles.labelRow}>
                  <span>Imágenes guardadas</span>
                  <span className={styles.hint}>
                    ← → · ×
                  </span>
                </span>
                <div className={styles.imageGrid}>
                  {existingImageUrls.map((url, index) => (
                    <div key={url} className={styles.thumbnailWrapper}>
                      <Image
                        src={url}
                        alt={`Imagen ${index + 1}`}
                        fill
                        sizes="80px"
                        className={styles.thumbnail}
                      />
                      <button
                        type="button"
                        className={styles.deleteImageBadge}
                        onClick={() => handleDeleteExistingImage(url)}
                        title="Eliminar imagen"
                      >
                        ×
                      </button>
                      <div className={styles.imageMoveButtons}>
                        <button
                          type="button"
                          className={styles.imageMoveBtn}
                          onClick={() => moveImage(index, 'left')}
                          disabled={index === 0}
                          title="Mover a la izquierda"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          className={styles.imageMoveBtn}
                          onClick={() => moveImage(index, 'right')}
                          disabled={index === existingImageUrls.length - 1}
                          title="Mover a la derecha"
                        >
                          →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label className={styles.uploadBox}>
              <span className={styles.labelRow}>
                <span>
                  {mode === 'edit'
                    ? 'Subir nuevas fotos'
                    : 'Fotos del vehículo'}
                </span>
                <span className={styles.hint}>{files.length} seleccionadas</span>
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif,.HEIC,.HEIF"
                multiple
                onChange={updateFiles}
                disabled={loading}
                className={styles.fileInput}
              />
              {files.length > 0 && (
                <ul className={styles.fileList}>
                  {files.map((file) => (
                    <li key={`${file.name}-${file.size}`}>
                      {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </li>
                  ))}
                </ul>
              )}
            </label>
          </div>

          {/* Right column: Frame/cuadro images */}
          <div className={styles.imageColumn}>
            <span className={styles.imageColumnTitle}>🖼️ Cuadro</span>

            {/* Existing frame images (only in Edit mode) */}
            {mode === 'edit' && existingFrameImageUrls.length > 0 && (
              <div className={styles.existingImages}>
                <span className={styles.labelRow}>
                  <span>Imágenes guardadas</span>
                  <span className={styles.hint}>
                    ← → · ×
                  </span>
                </span>
                <div className={styles.imageGrid}>
                  {existingFrameImageUrls.map((url, index) => (
                    <div key={url} className={styles.thumbnailWrapper}>
                      <Image
                        src={url}
                        alt={`Cuadro ${index + 1}`}
                        fill
                        sizes="80px"
                        className={styles.thumbnail}
                      />
                      <button
                        type="button"
                        className={styles.deleteImageBadge}
                        onClick={() => handleDeleteExistingFrameImage(url)}
                        title="Eliminar imagen"
                      >
                        ×
                      </button>
                      <div className={styles.imageMoveButtons}>
                        <button
                          type="button"
                          className={styles.imageMoveBtn}
                          onClick={() => moveFrameImage(index, 'left')}
                          disabled={index === 0}
                          title="Mover a la izquierda"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          className={styles.imageMoveBtn}
                          onClick={() => moveFrameImage(index, 'right')}
                          disabled={index === existingFrameImageUrls.length - 1}
                          title="Mover a la derecha"
                        >
                          →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label className={styles.uploadBox}>
              <span className={styles.labelRow}>
                <span>
                  {mode === 'edit'
                    ? 'Subir nuevas fotos'
                    : 'Fotos del cuadro'}
                </span>
                <span className={styles.hint}>{frameFiles.length} seleccionadas</span>
              </span>
              <input
                ref={frameFileInputRef}
                type="file"
                accept="image/*,.heic,.heif,.HEIC,.HEIF"
                multiple
                onChange={updateFrameFiles}
                disabled={loading}
                className={styles.fileInput}
              />
              {frameFiles.length > 0 && (
                <ul className={styles.fileList}>
                  {frameFiles.map((file) => (
                    <li key={`frame-${file.name}-${file.size}`}>
                      {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </li>
                  ))}
                </ul>
              )}
            </label>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        {mode === 'edit' ? (
          <>
            <button
              type="button"
              disabled={loading}
              onClick={onDelete}
              className={styles.dangerButton}
            >
              {loading ? 'Procesando...' : 'Eliminar artículo'}
            </button>
            <div className={styles.rightActions}>
              <button
                type="button"
                disabled={loading}
                onClick={onCancel}
                className={styles.secondaryButton}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className={styles.primaryButton}
              >
                {loading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={loading}
              onClick={onReset}
              className={styles.secondaryButton}
            >
              Limpiar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={styles.primaryButton}
            >
              {loading ? 'Guardando...' : 'Guardar artículo'}
            </button>
          </>
        )}
      </div>
    </form>
  );
}
