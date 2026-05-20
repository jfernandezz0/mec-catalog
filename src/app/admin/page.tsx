'use client';

import { supabase } from '@/lib/supabase';
import { getFlagEmoji } from '@/lib/utils';
import { User } from '@supabase/supabase-js';
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import styles from './admin.module.css';
import Image from 'next/image';

type Category = {
  id: number;
  name: string;
  country_code: string;
  is_visible?: boolean;
};

type Article = {
  id: number;
  category_id: number;
  title: string;
  description: string | null;
  price: number | string;
  quantity: number;
  image_urls: string[] | null;
  sort_order: number;
};

type FormState = {
  categoryId: string;
  marca: string;
  modelo: string;
  description: string;
  price: string;
  quantity: string;
};

const initialFormState: FormState = {
  categoryId: '',
  marca: '',
  modelo: '',
  description: '',
  price: '',
  quantity: '1',
};

function getSafeFilePath(file: File) {
  const extension = file.name.split('.').pop() || 'jpg';
  const fileName = `${crypto.randomUUID()}.${extension.toLowerCase()}`;

  return `articles/${fileName}`;
}

function formatPrice(value: number | string) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value));
}

export default function AdminPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [activeTab, setActiveTab] = useState<'catalog' | 'create' | 'edit' | 'categories'>('catalog');
  
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingArticles, setLoadingArticles] = useState(true);

  // Edit-specific states
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);

  // Auth states
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // New category form state
  const [categoryName, setCategoryName] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryUpdatingId, setCategoryUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    async function getSession() {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setCheckingAuth(false);
    }
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    async function loadCategories() {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, country_code, is_visible')
        .order('id', { ascending: true });

      if (error) {
        alert(`Could not load categories: ${error.message}`);
      }

      setCategories(data ?? []);
      setLoadingCategories(false);
    }

    loadCategories();
    loadArticles();
  }, [user]);

  async function loadArticles() {
    setLoadingArticles(true);
    const { data, error } = await supabase
      .from('articles')
      .select('id, category_id, title, description, price, quantity, image_urls, sort_order')
      .order('sort_order', { ascending: true });

    if (error) {
      alert(`Could not load articles: ${error.message}`);
    }

    setArticles(data ?? []);
    setLoadingArticles(false);
  }

  function updateField(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;

    setFormState((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function updateFiles(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files ?? []));
  }

  function resetForm() {
    setFormState(initialFormState);
    setFiles([]);
    setEditingArticle(null);
    setExistingImageUrls([]);
    setImagesToDelete([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleTabChange(tab: 'catalog' | 'create' | 'categories') {
    resetForm();
    setActiveTab(tab);
    if (tab === 'catalog') {
      loadArticles();
    }
  }

  function startEditing(article: Article) {
    setEditingArticle(article);
    setFormState({
      categoryId: String(article.category_id),
      marca: article.title.includes(' – ') ? article.title.split(' – ')[0] : article.title,
      modelo: article.title.includes(' – ') ? article.title.split(' – ').slice(1).join(' – ') : '',
      description: article.description ?? '',
      price: String(article.price),
      quantity: String(article.quantity),
    });
    setExistingImageUrls(article.image_urls ?? []);
    setImagesToDelete([]);
    setFiles([]);
    setActiveTab('edit');
  }

  function handleDeleteExistingImage(url: string) {
    setExistingImageUrls((current) => current.filter((u) => u !== url));
    setImagesToDelete((current) => [...current, url]);
  }

  function moveImage(index: number, direction: 'left' | 'right') {
    setExistingImageUrls((current) => {
      const next = [...current];
      const swapIndex = direction === 'left' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= next.length) return current;
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next;
    });
  }

  async function moveArticle(articleId: number, direction: 'up' | 'down') {
    const idx = articles.findIndex((a) => a.id === articleId);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= articles.length) return;

    const a = articles[idx];
    const b = articles[swapIdx];

    // Swap sort_order values
    const [orderA, orderB] = [a.sort_order, b.sort_order];

    await Promise.all([
      supabase.from('articles').update({ sort_order: orderB }).eq('id', a.id),
      supabase.from('articles').update({ sort_order: orderA }).eq('id', b.id),
    ]);

    // Update local state immediately
    setArticles((current) => {
      const next = [...current];
      next[idx] = { ...a, sort_order: orderB };
      next[swapIdx] = { ...b, sort_order: orderA };
      return next.sort((x, y) => x.sort_order - y.sort_order);
    });
  }

  async function deleteStorageImages(urls: string[]) {
    const paths = urls
      .map((url) => {
        const marker = '/product-images/';
        const index = url.indexOf(marker);
        return index !== -1 ? url.substring(index + marker.length) : null;
      })
      .filter((p): p is string => p !== null);

    if (paths.length > 0) {
      const { error } = await supabase.storage
        .from('product-images')
        .remove(paths);
      
      if (error) {
        console.error('Error deleting images from storage:', error.message);
      }
    }
  }

  async function uploadImages() {
    const imageUrls: string[] = [];

    for (const file of files) {
      const filePath = getSafeFilePath(file);
      const { error } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw new Error(`Could not upload ${file.name}: ${error.message}`);
      }

      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      imageUrls.push(data.publicUrl);
    }

    return imageUrls;
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const price = Number(formState.price);
    const quantity = Number.parseInt(formState.quantity, 10);

    if (!formState.categoryId || Number.isNaN(price) || Number.isNaN(quantity)) {
      alert('Please complete the required fields.');
      return;
    }

    setLoading(true);

    try {
      const imageUrls = await uploadImages();
      const { error } = await supabase.from('articles').insert({
        category_id: Number(formState.categoryId),
        title: `${formState.marca.trim()} – ${formState.modelo.trim()}`,
        description: formState.description,
        price,
        quantity,
        image_urls: imageUrls,
      });

      if (error) {
        throw new Error(error.message);
      }

      alert('Article created successfully.');
      resetForm();
      await loadArticles();
      setActiveTab('catalog');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not create article.');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingArticle) return;

    const price = Number(formState.price);
    const quantity = Number.parseInt(formState.quantity, 10);

    if (!formState.categoryId || Number.isNaN(price) || Number.isNaN(quantity)) {
      alert('Please complete the required fields.');
      return;
    }

    setLoading(true);

    try {
      const newUrls = await uploadImages();
      const finalImageUrls = [...existingImageUrls, ...newUrls];

      const { error } = await supabase
        .from('articles')
        .update({
          category_id: Number(formState.categoryId),
          title: `${formState.marca.trim()} – ${formState.modelo.trim()}`,
          description: formState.description,
          price,
          quantity,
          image_urls: finalImageUrls,
        })
        .eq('id', editingArticle.id);

      if (error) {
        throw new Error(error.message);
      }

      if (imagesToDelete.length > 0) {
        await deleteStorageImages(imagesToDelete);
      }

      alert('Article updated successfully.');
      resetForm();
      await loadArticles();
      setActiveTab('catalog');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not update article.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!editingArticle) return;

    const confirmed = confirm(
      '¿Estás seguro de que deseas eliminar este artículo de forma permanente? Esta acción no se puede deshacer.'
    );
    
    if (!confirmed) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from('articles')
        .delete()
        .eq('id', editingArticle.id);

      if (error) {
        throw new Error(error.message);
      }

      const urlsToDelete = editingArticle.image_urls ?? [];
      if (urlsToDelete.length > 0) {
        await deleteStorageImages(urlsToDelete);
      }

      alert('Article deleted successfully.');
      resetForm();
      await loadArticles();
      setActiveTab('catalog');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not delete article.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryName.trim() || !categoryCode.trim()) {
      alert('Por favor, rellena todos los campos.');
      return;
    }

    setCategoryLoading(true);

    try {
      const codeClean = categoryCode.toUpperCase().trim();
      const { error } = await supabase
        .from('categories')
        .insert([
          {
            name: categoryName.trim(),
            country_code: codeClean,
            is_visible: true,
          },
        ]);

      if (error) {
        throw new Error(error.message);
      }

      alert('Categoría creada correctamente.');
      setCategoryName('');
      setCategoryCode('');
      await reloadCategories();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al crear la categoría.');
    } finally {
      setCategoryLoading(false);
    }
  }

  async function reloadCategories() {
    const { data: catData, error: catError } = await supabase
      .from('categories')
      .select('id, name, country_code, is_visible')
      .order('id', { ascending: true });

    if (catError) {
      throw new Error(catError.message);
    }

    setCategories(catData ?? []);
  }

  async function handleToggleCategoryVisibility(categoryId: number, currentVisibility: boolean | undefined) {
    setCategoryUpdatingId(categoryId);

    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_visible: !currentVisibility })
        .eq('id', categoryId);

      if (error) {
        throw new Error(error.message);
      }

      await reloadCategories();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al actualizar la visibilidad.');
    } finally {
      setCategoryUpdatingId(null);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al iniciar sesión.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert(`Error al cerrar sesión: ${error.message}`);
    } else {
      setUser(null);
    }
  }

  if (checkingAuth) {
    return (
      <main className={styles.page}>
        <div className={styles.loading}>Verificando sesión...</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <Image src="/logo_mini.png" alt="MiniEngines Creations" width={72} height={72} style={{ objectFit: 'contain' }} />
          </div>
          <h1 className={styles.loginLogo}>MiniEngines Creations</h1>
          <p className={styles.loginTitle}>Administrador de Catálogo</p>
          <form onSubmit={handleLogin} className={styles.loginForm}>
            <div className={styles.loginField}>
              <label className={styles.loginLabel} htmlFor="email">
                Correo Electrónico
              </label>
              <input
                id="email"
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                disabled={authLoading}
                className={styles.loginInput}
              />
            </div>
            <div className={styles.loginField}>
              <label className={styles.loginLabel} htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                disabled={authLoading}
                className={styles.loginInput}
              />
            </div>
            <button
              type="submit"
              disabled={authLoading}
              className={styles.loginButton}
            >
              {authLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/logo_mini.png" alt="MiniEngines Creations" width={40} height={40} style={{ objectFit: 'contain' }} />
            <div>
              <p className={styles.eyebrow}>Catalog admin</p>
              <h1 className={styles.title}>
              {activeTab === 'catalog'
                ? 'Gestionar Catálogo'
                : activeTab === 'create'
                ? 'Añadir artículo'
                : 'Editar artículo'}
            </h1>
            <p className={styles.subtitle}>
              {activeTab === 'catalog'
                ? 'Ver, editar o eliminar los artículos del catálogo digital.'
                : activeTab === 'create'
                ? 'Crea un artículo, sube sus fotos y asígnalo a una categoría de país.'
                : 'Modifica los campos del artículo, gestiona sus imágenes o bórralo permanentemente.'}
            </p>
            </div>
          </div>

          <div className={styles.headerRight}>
            <div className={styles.status}>
              <span className={styles.statusValue}>
                {loadingArticles ? '...' : articles.length}
              </span>
              <span className={styles.statusLabel}>artículos en catálogo</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className={styles.logoutButton}
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        {/* Tabs navigation */}
        <nav className={styles.tabs} aria-label="Secciones de administración">
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'catalog' ? styles.tabActive : ''}`}
            onClick={() => handleTabChange('catalog')}
          >
            Catálogo
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'create' ? styles.tabActive : ''}`}
            onClick={() => handleTabChange('create')}
          >
            + Nuevo Artículo
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'categories' ? styles.tabActive : ''}`}
            onClick={() => handleTabChange('categories')}
          >
            Categorías
          </button>
          {activeTab === 'edit' && (
            <button
              type="button"
              className={`${styles.tab} ${styles.tabActive}`}
              disabled
            >
              Ficha: {editingArticle?.title.substring(0, 20) || 'Editar'}...
            </button>
          )}
        </nav>

        {/* Catalog View */}
        {activeTab === 'catalog' && (
          <div>
            {loadingArticles ? (
              <div className={styles.loading}>Cargando catálogo...</div>
            ) : articles.length > 0 ? (
              <div className={styles.catalogGrid}>
                {articles.map((article) => {
                  const categoryName =
                    categories.find((c) => c.id === article.category_id)?.name ||
                    'Sin categoría';
                  const primaryImageUrl =
                    article.image_urls && article.image_urls.length > 0
                      ? article.image_urls[0]
                      : null;

                  return (
                    <article key={article.id} className={styles.catalogCard}>
                      <div className={styles.cardImageWrap}>
                        {primaryImageUrl ? (
                          <Image
                            src={primaryImageUrl}
                            alt={article.title}
                            fill
                            sizes="(max-width: 640px) 100vw, 400px"
                            className={styles.cardImage}
                          />
                        ) : (
                          <div className={styles.cardNoImage}>Sin imagen</div>
                        )}
                      </div>
                      <div className={styles.cardContent}>
                        <span className={styles.cardCategory}>{categoryName}</span>
                        {(() => {
                          const parts = article.title.split(' – ');
                          const marca = parts[0];
                          const modelo = parts.slice(1).join(' – ');
                          return modelo ? (
                            <h2 className={styles.cardTitle}>
                              <span className={styles.cardBrand}>{marca}</span>
                              <span>{modelo}</span>
                            </h2>
                          ) : (
                            <h2 className={styles.cardTitle}>{article.title}</h2>
                          );
                        })()}
                        <div className={styles.cardMeta}>
                          <span className={styles.cardPrice}>
                            {formatPrice(article.price)}
                          </span>
                          <span className={styles.cardStock}>
                            {article.quantity} ud.
                          </span>
                        </div>
                        <div className={styles.cardActions}>
                          <button
                            type="button"
                            className={styles.cardOrderButton}
                            onClick={() => moveArticle(article.id, 'up')}
                            aria-label="Subir"
                            title="Subir"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className={styles.cardOrderButton}
                            onClick={() => moveArticle(article.id, 'down')}
                            aria-label="Bajar"
                            title="Bajar"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className={styles.cardEditButton}
                            onClick={() => startEditing(article)}
                          >
                            Abrir Ficha / Editar
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <h2 className={styles.emptyTitle}>Catálogo vacío</h2>
                <p className={styles.emptyText}>
                  Aún no has añadido ningún artículo al catálogo digital.
                </p>
                <button
                  type="button"
                  className={styles.emptyButton}
                  onClick={() => setActiveTab('create')}
                >
                  Crear primer artículo
                </button>
              </div>
            )}
          </div>
        )}

        {/* Create/Edit Form View */}
        {(activeTab === 'create' || activeTab === 'edit') && (
          <form
            onSubmit={activeTab === 'create' ? handleCreateSubmit : handleUpdateSubmit}
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
              <h2 className={styles.sectionTitle}>Imágenes</h2>

              {/* Existing images manager (only in Edit mode) */}
              {activeTab === 'edit' && existingImageUrls.length > 0 && (
                  <div className={styles.existingImages}>
                  <span className={styles.labelRow}>
                    <span>Imágenes guardadas</span>
                    <span className={styles.hint}>
                      ← → para reordenar · × para eliminar
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
                    {activeTab === 'edit'
                      ? 'Subir nuevas fotos'
                      : 'Fotos del producto'}
                  </span>
                  <span className={styles.hint}>{files.length} seleccionadas</span>
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
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

            <div className={styles.actions}>
              {activeTab === 'edit' ? (
                <>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleDelete}
                    className={styles.dangerButton}
                  >
                    {loading ? 'Procesando...' : 'Eliminar artículo'}
                  </button>
                  <div className={styles.rightActions}>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleTabChange('catalog')}
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
                    onClick={resetForm}
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
        )}

        {/* Categories Tab View */}
        {activeTab === 'categories' && (
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
                {categories.length > 0 ? (
                  <div className={styles.categoryGridCompact}>
                    {categories.map((cat) => (
                      <div key={cat.id} className={styles.categoryRow}>
                        <span className={styles.categoryFlag}>
                          {getFlagEmoji(cat.country_code)}
                        </span>
                        <div className={styles.categoryInfo}>
                          <span className={styles.categoryNameText}>{cat.name}</span>
                          <span className={styles.categoryCodeText}>{cat.country_code}</span>
                          {!cat.is_visible && (
                            <span className={styles.categoryHiddenBadge}>Oculta</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => handleToggleCategoryVisibility(cat.id, cat.is_visible)}
                          disabled={categoryUpdatingId === cat.id}
                          style={{ marginLeft: 'auto' }}
                        >
                          {categoryUpdatingId === cat.id
                            ? 'Guardando...'
                            : cat.is_visible === false
                            ? 'Mostrar'
                            : 'Ocultar'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.emptyText}>No hay categorías creadas.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
