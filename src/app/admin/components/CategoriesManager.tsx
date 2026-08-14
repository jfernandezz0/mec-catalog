'use client';

import { useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { getFlagEmoji, isValidISOCode } from '@/lib/utils';
import { Category, Article } from '@/lib/types';
import { User } from '@supabase/supabase-js';
import styles from '../admin.module.css';

interface CategoriesManagerProps {
  categories: Category[];
  articles: Article[];
  user: User | null;
  hasVisibilityColumn: boolean;
  reloadCategories: () => Promise<void>;
}

export default function CategoriesManager({
  categories,
  articles,
  user,
  hasVisibilityColumn,
  reloadCategories,
}: CategoriesManagerProps) {
  const [categoryName, setCategoryName] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryLogo, setCategoryLogo] = useState<File | null>(null);
  const [logoInputKey, setLogoInputKey] = useState(0);
  const [categoryUpdatingId, setCategoryUpdatingId] = useState<number | null>(null);

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      alert('Debes iniciar sesión para realizar esta acción.');
      return;
    }

    if (!categoryName.trim() || !categoryCode.trim()) {
      alert('Por favor, rellena todos los campos.');
      return;
    }

    const codeClean = categoryCode.toUpperCase().trim();
    const nameClean = categoryName.trim();

    // 1. Validar que el código ISO sea correcto
    if (!isValidISOCode(codeClean)) {
      alert('El código ISO no es válido (ej. ES, KR, USA). Revisa el código ingresado.');
      return;
    }

    // 2. Validar localmente si el código ISO o nombre ya está en uso (rápido)
    const codeExistsLocally = categories.some(
      (c) => c.country_code?.toUpperCase().trim() === codeClean
    );
    if (codeExistsLocally) {
      alert(`El código ISO "${codeClean}" ya está en uso por otra categoría.`);
      return;
    }

    const nameExistsLocally = categories.some(
      (c) => c.name?.toUpperCase().trim() === nameClean.toUpperCase()
    );
    if (nameExistsLocally) {
      alert(`El nombre del país "${nameClean}" ya está en uso por otra categoría.`);
      return;
    }

    setCategoryLoading(true);

    try {
      // 3. Validar en base de datos en tiempo real (seguridad ante cambios concurrentes)
      const { data: dbCodeData, error: dbCodeError } = await supabase
        .from('categories')
        .select('id')
        .ilike('country_code', codeClean);

      if (dbCodeError) {
        throw new Error(`Error al verificar el código ISO en la base de datos: ${dbCodeError.message}`);
      }
      if (dbCodeData && dbCodeData.length > 0) {
        throw new Error(`El código ISO "${codeClean}" ya está registrado en la base de datos.`);
      }

      const { data: dbNameData, error: dbNameError } = await supabase
        .from('categories')
        .select('id')
        .ilike('name', nameClean);

      if (dbNameError) {
        throw new Error(`Error al verificar el nombre en la base de datos: ${dbNameError.message}`);
      }
      if (dbNameData && dbNameData.length > 0) {
        throw new Error(`El nombre de país "${nameClean}" ya está registrado en la base de datos.`);
      }

      const categoryRecord: Record<string, unknown> = {
        name: nameClean,
        country_code: codeClean,
        is_visible: true,
      };

      const { error } = await supabase
        .from('categories')
        .insert([categoryRecord]);

      if (error) {
        if (error.message.includes('is_visible')) {
          const { error: fallbackError } = await supabase
            .from('categories')
            .insert([
              {
                name: nameClean,
                country_code: codeClean,
              },
            ]);

          if (fallbackError) {
            if (fallbackError.message.includes('duplicate key') || fallbackError.message.includes('unique constraint')) {
              throw new Error('Ya existe una categoría con ese nombre o código ISO.');
            }
            throw new Error(fallbackError.message);
          }
        } else {
          if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
            throw new Error('Ya existe una categoría con ese nombre o código ISO.');
          }
          throw new Error(error.message);
        }
      }

      // Upload logo if one is selected
      if (categoryLogo) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const formData = new FormData();
        formData.append('logo', categoryLogo);
        formData.append('countryCode', codeClean);

        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const uploadRes = await fetch('/api/upload-category-logo', {
          method: 'POST',
          body: formData,
          headers,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(`Categoría creada, pero falló la subida del logo: ${errData.error || uploadRes.statusText}`);
        }
      }

      alert('Categoría creada correctamente.');
      setLogoInputKey(prev => prev + 1);
      window.location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al crear la categoría.');
    } finally {
      setCategoryLoading(false);
    }
  }

  async function handleToggleCategoryVisibility(categoryId: number, currentVisibility: boolean | undefined) {
    setCategoryUpdatingId(categoryId);

    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_visible: !currentVisibility })
        .eq('id', categoryId);

      if (error) throw new Error(error.message);

      await reloadCategories();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al actualizar la visibilidad.');
    } finally {
      setCategoryUpdatingId(null);
    }
  }

  async function handleDeleteCategory(categoryId: number, catName: string) {
    const linkedCount = articles.filter((a) => a.category_id === categoryId).length;
    if (linkedCount > 0) {
      alert(`No se puede eliminar "${catName}" porque tiene ${linkedCount} artículo${linkedCount === 1 ? '' : 's'} asociado${linkedCount === 1 ? '' : 's'}. Elimina o mueve los artículos primero.`);
      return;
    }

    const confirmed = confirm(`¿Eliminar permanentemente la categoría "${catName}"? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    setCategoryUpdatingId(categoryId);

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw new Error(error.message);

      await reloadCategories();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al eliminar la categoría.');
    } finally {
      setCategoryUpdatingId(null);
    }
  }

  return (
    <div className={styles.categoriesSection}>
      <div className={styles.categoriesLayout}>
        {/* Form to create new category */}
        <div className={styles.categoryFormCard}>
          <h2 className={styles.sectionTitle}>Añadir nuevo País / Categoría</h2>
          <p className={styles.categoryInstruction}>
            Introduce el nombre del país y su código estándar de 2 letras (ej. ES para España). El sistema generará su bandera automáticamente.
          </p>
          <form onSubmit={handleCreateCategory} className={styles.compactForm}>
            <label className={styles.field}>
              <span className={styles.labelRow}>
                <span>Nombre del País</span>
                <span className={styles.hint}>Requerido</span>
              </span>
              <input
                type="text"
                required
                placeholder="Ej. España"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                disabled={categoryLoading}
                className={styles.control}
              />
            </label>
            
            <label className={styles.field}>
              <span className={styles.labelRow}>
                <span>Código ISO (2 letras)</span>
                <span className={styles.hint}>Requerido</span>
              </span>
              <input
                type="text"
                required
                maxLength={2}
                placeholder="Ej. ES"
                value={categoryCode}
                onChange={(e) => setCategoryCode(e.target.value)}
                disabled={categoryLoading}
                className={styles.control}
                style={{ textTransform: 'uppercase' }}
              />
            </label>
            
            <label className={styles.field}>
              <span className={styles.labelRow}>
                <span>Logotipo / Bandera (Opcional)</span>
                <span className={styles.hint}>PNG (Debe llamarse MEC_[ISO].png)</span>
              </span>
              <input
                key={logoInputKey}
                type="file"
                accept=".png"
                onChange={(e) => setCategoryLogo(e.target.files?.[0] || null)}
                disabled={categoryLoading}
                className={styles.control}
              />
            </label>
            
            <button
              type="submit"
              disabled={categoryLoading}
              className={styles.primaryButton}
              style={{ marginTop: '16px', width: '100%' }}
            >
              {categoryLoading ? 'Creando...' : 'Crear Categoría'}
            </button>
          </form>
        </div>

        {/* List of existing categories */}
        <div className={styles.categoryListCard}>
          <h2 className={styles.sectionTitle}>Países y Categorías Activas</h2>
          <p className={styles.categoryInstruction}>
            Gestiona las categorías desde aquí. Puedes mostrar/ocultar categorías a los usuarios, y eliminar categorías enteras (no se pueden eliminar si contienen artículos asociados).
          </p>
          {categories.length > 0 ? (
            <div className={styles.categoryGridCompact}>
              {[...categories]
                .sort((a, b) => {
                  const countA = articles.filter((art) => art.category_id === a.id).length;
                  const countB = articles.filter((art) => art.category_id === b.id).length;
                  if (countB !== countA) {
                    return countB - countA;
                  }
                  return a.id - b.id;
                })
                .map((cat) => {
                  const linkedCount = articles.filter((a) => a.category_id === cat.id).length;
                const isUpdating = categoryUpdatingId === cat.id;
                const isHidden = hasVisibilityColumn && cat.is_visible === false;
                return (
                  <div key={cat.id} className={`${styles.categoryRow} ${isHidden ? styles.categoryRowHidden : ''}`}>
                    <span className={styles.categoryFlag}>
                      {getFlagEmoji(cat.country_code)}
                    </span>
                    <div className={styles.categoryInfo}>
                      <span className={styles.categoryNameText}>{cat.name}</span>
                      <span className={styles.categoryCodeText}>{cat.country_code}</span>
                      {linkedCount > 0 && (
                        <span className={styles.categoryArticlesBadge}>{linkedCount} art.</span>
                      )}
                      {isHidden && (
                        <span className={styles.categoryHiddenBadge}>Oculta</span>
                      )}
                    </div>
                    <div className={styles.categoryActions}>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => handleToggleCategoryVisibility(cat.id, cat.is_visible)}
                        disabled={isUpdating || !hasVisibilityColumn}
                        title={!hasVisibilityColumn ? 'Añade la columna is_visible en Supabase para activar esta función' : undefined}
                      >
                        {isUpdating ? '...' : isHidden ? 'Mostrar' : 'Ocultar'}
                      </button>
                      <button
                        type="button"
                        className={styles.dangerButtonSmall}
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        disabled={isUpdating}
                        title={linkedCount > 0 ? `Tiene ${linkedCount} artículo${linkedCount === 1 ? '' : 's'} — elimínalos primero` : 'Eliminar categoría'}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={styles.emptyText}>No hay categorías creadas.</p>
          )}
        </div>
      </div>
    </div>
  );
}
