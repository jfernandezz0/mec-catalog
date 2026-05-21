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
  contact_clicks?: number;
  share_clicks?: number;
};

type ImportRow = {
  rowIndex: number;
  categoria: string;
  marca: string;
  modelo: string;
  precio: string;
  cantidad: string;
  descripcion: string;
  errors: string[];
  categoryId: number | null;
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

function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<File> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !file.type.startsWith('image/')) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file);
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }
            const originalNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
            const newName = `${originalNameWithoutExt}.jpg`;
            const compressedFile = new File([blob], newName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
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
  const [activeTab, setActiveTab] = useState<'catalog' | 'create' | 'edit' | 'categories' | 'import'>('catalog');
  
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [hasVisibilityColumn, setHasVisibilityColumn] = useState(true);

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

  // Catalog filter state
  const [selectedCatalogCategoryId, setSelectedCatalogCategoryId] = useState<number | null>(null);

  // CSV import states
  const [csvRows, setCsvRows] = useState<ImportRow[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvImportProgress, setCsvImportProgress] = useState(0);
  const [csvImportResults, setCsvImportResults] = useState<{ success: number; failed: number } | null>(null);
  const [csvDragOver, setCsvDragOver] = useState(false);

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
        if (error.message.includes('is_visible')) {
          setHasVisibilityColumn(false);
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('categories')
            .select('id, name, country_code')
            .order('id', { ascending: true });

          if (fallbackError) {
            alert(`Could not load categories: ${fallbackError.message}`);
            setCategories([]);
          } else {
            setCategories(
              (fallbackData ?? []).map((category) => ({
                ...category,
                is_visible: true,
              }))
            );
          }
        } else {
          alert(`Could not load categories: ${error.message}`);
          setCategories([]);
        }
      } else {
        setHasVisibilityColumn(true);
        setCategories(data ?? []);
      }

      setLoadingCategories(false);
    }

    loadCategories();
    loadArticles();
  }, [user]);

  async function loadArticles() {
    setLoadingArticles(true);
    const { data, error } = await supabase
      .from('articles')
      .select('id, category_id, title, description, price, quantity, image_urls, sort_order, contact_clicks, share_clicks')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });

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

  function handleTabChange(tab: 'catalog' | 'create' | 'categories' | 'import') {
    resetForm();
    setActiveTab(tab);
    setSelectedCatalogCategoryId(null);
    setCsvRows([]);
    setCsvFileName('');
    setCsvImportResults(null);
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

  async function moveArticle(articleId: number, direction: 'up' | 'down', contextArticles: Article[]) {
    const idx = contextArticles.findIndex((a) => a.id === articleId);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= contextArticles.length) return;

    const a = contextArticles[idx];
    const b = contextArticles[swapIdx];

    // Check if there are any null/undefined or duplicate sort_orders in contextArticles
    const hasNullOrDuplicate = contextArticles.some((art, index) => 
      art.sort_order === null || 
      art.sort_order === undefined || 
      contextArticles.findIndex(o => o.sort_order === art.sort_order) !== index
    );

    if (hasNullOrDuplicate) {
      // Re-sequence all contextArticles, swapping the sort_orders of idx and swapIdx
      const updates = contextArticles.map((art, index) => {
        let targetOrder = index;
        if (index === idx) {
          targetOrder = swapIdx;
        } else if (index === swapIdx) {
          targetOrder = idx;
        }
        return {
          id: art.id,
          sort_order: targetOrder
        };
      });

      // Update Supabase
      await Promise.all(
        updates.map((upd) =>
          supabase.from('articles').update({ sort_order: upd.sort_order }).eq('id', upd.id)
        )
      );

      // Update local state
      setArticles((current) => {
        const updated = current.map((art) => {
          const upd = updates.find((u) => u.id === art.id);
          if (upd) {
            return { ...art, sort_order: upd.sort_order };
          }
          return art;
        });
        return updated.sort((x, y) => {
          const ox = x.sort_order ?? 0;
          const oy = y.sort_order ?? 0;
          if (ox !== oy) return ox - oy;
          return x.id - y.id;
        });
      });
    } else {
      // Simple swap of existing distinct, non-null sort_orders
      const orderA = a.sort_order;
      const orderB = b.sort_order;

      await Promise.all([
        supabase.from('articles').update({ sort_order: orderB }).eq('id', a.id),
        supabase.from('articles').update({ sort_order: orderA }).eq('id', b.id),
      ]);

      // Update local state immediately
      setArticles((current) => {
        const updated = current.map((art) => {
          if (art.id === a.id) return { ...art, sort_order: orderB };
          if (art.id === b.id) return { ...art, sort_order: orderA };
          return art;
        });
        return updated.sort((x, y) => {
          const ox = x.sort_order ?? 0;
          const oy = y.sort_order ?? 0;
          if (ox !== oy) return ox - oy;
          return x.id - y.id;
        });
      });
    }
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
      const compressedFile = await compressImage(file);
      const filePath = getSafeFilePath(compressedFile);
      const { error } = await supabase.storage
        .from('product-images')
        .upload(filePath, compressedFile, {
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
      const categoryRecord: Record<string, unknown> = {
        name: categoryName.trim(),
        country_code: codeClean,
      };

      categoryRecord.is_visible = true;

      const { error } = await supabase
        .from('categories')
        .insert([categoryRecord]);

      if (error) {
        if (error.message.includes('is_visible')) {
          const { error: fallbackError } = await supabase
            .from('categories')
            .insert([
              {
                name: categoryName.trim(),
                country_code: codeClean,
              },
            ]);

          if (fallbackError) {
            throw new Error(fallbackError.message);
          }
        } else {
          throw new Error(error.message);
        }
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
      if (catError.message.includes('is_visible')) {
        setHasVisibilityColumn(false);
        const { data: fallbackCatData, error: fallbackCatError } = await supabase
          .from('categories')
          .select('id, name, country_code')
          .order('id', { ascending: true });

        if (fallbackCatError) {
          throw new Error(fallbackCatError.message);
        }

        setCategories(
          (fallbackCatData ?? []).map((category) => ({
            ...category,
            is_visible: true,
          }))
        );
        return;
      }

      throw new Error(catError.message);
    }

    setHasVisibilityColumn(true);
    setCategories(catData ?? []);
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

  async function handleDeleteCategory(categoryId: number, categoryName: string) {
    const linkedCount = articles.filter((a) => a.category_id === categoryId).length;
    if (linkedCount > 0) {
      alert(`No se puede eliminar "${categoryName}" porque tiene ${linkedCount} artículo${linkedCount === 1 ? '' : 's'} asociado${linkedCount === 1 ? '' : 's'}. Elimina o mueve los artículos primero.`);
      return;
    }

    const confirmed = confirm(`¿Eliminar permanentemente la categoría "${categoryName}"? Esta acción no se puede deshacer.`);
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
      const { error } = await supabase.from('articles').insert({
        category_id: row.categoryId!,
        title: `${row.marca.trim()} – ${row.modelo.trim()}`,
        description: row.descripcion.trim() || null,
        price: Number(row.precio.replace(',', '.')),
        quantity: Number(row.cantidad),
        image_urls: [],
      });
      if (error) { failed++; } else { success++; }
      setCsvImportProgress((p) => p + 1);
    }
    setCsvImportResults({ success, failed });
    setCsvImporting(false);
    if (success > 0) await loadArticles();
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
                : activeTab === 'categories'
                ? 'Categorías y Países'
                : activeTab === 'import'
                ? 'Importar artículos'
                : 'Editar artículo'}
            </h1>
            <p className={styles.subtitle}>
              {activeTab === 'catalog'
                ? 'Ver, editar o eliminar los artículos y categorías del catálogo digital.'
                : activeTab === 'create'
                ? 'Crea un artículo, sube sus fotos y asígnalo a una categoría de país.'
                : activeTab === 'categories'
                ? 'Gestiona las categorías desde aquí. Puedes mostrar/ocultar y eliminar categorías.'
                : activeTab === 'import'
                ? 'Importa múltiples artículos de golpe subiendo un archivo CSV.'
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
          <div className={styles.tabsLeft}>
            <button
              type="button"
              className={`${styles.tab} ${activeTab === 'catalog' ? styles.tabActive : ''}`}
              onClick={() => handleTabChange('catalog')}
            >
              Catálogo
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
          </div>
          <div className={styles.tabsRight}>
            <button
              type="button"
              className={`${styles.actionButton} ${styles.actionButtonGreen} ${activeTab === 'create' ? styles.actionButtonActive : ''}`}
              onClick={() => handleTabChange('create')}
            >
              + Nuevo Artículo
            </button>
            <button
              type="button"
              className={`${styles.actionButton} ${styles.actionButtonBlue} ${activeTab === 'import' ? styles.actionButtonActive : ''}`}
              onClick={() => handleTabChange('import')}
            >
              ↑ Importar CSV
            </button>
          </div>
        </nav>


        {/* Catalog View */}
        {activeTab === 'catalog' && (() => {
          const displayedArticles = selectedCatalogCategoryId === null
            ? articles
            : articles.filter((a) => a.category_id === selectedCatalogCategoryId);

          return (
            <div>
              {/* Category filter submenu */}
              {!loadingArticles && categories.length > 0 && (
                <div className={styles.catalogCategoryFilter}>
                  <button
                    type="button"
                    className={`${styles.catalogCategoryPill} ${selectedCatalogCategoryId === null ? styles.catalogCategoryPillActive : ''}`}
                    onClick={() => setSelectedCatalogCategoryId(null)}
                  >
                    Todas
                    <span className={styles.catalogPillCount}>{articles.length}</span>
                  </button>
                  {categories.map((cat) => {
                    const count = articles.filter((a) => a.category_id === cat.id).length;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        className={`${styles.catalogCategoryPill} ${selectedCatalogCategoryId === cat.id ? styles.catalogCategoryPillActive : ''}`}
                        onClick={() => setSelectedCatalogCategoryId(cat.id)}
                      >
                        {getFlagEmoji(cat.country_code)} {cat.name}
                        <span className={styles.catalogPillCount}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {loadingArticles ? (
                <div className={styles.loading}>Cargando catálogo...</div>
              ) : displayedArticles.length > 0 ? (
                <div className={styles.catalogGrid}>
                  {displayedArticles.map((article) => {
                    const catName =
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
                          <span className={styles.cardCategory}>{catName}</span>
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
                            <div className="flex gap-2 items-center">
                              <span className={styles.cardClicks} title="Clics de contacto recibidos">
                                📞 {article.contact_clicks ?? 0}
                              </span>
                              <span className={styles.cardShareClicks} title="Clics de compartir recibidos">
                                🔗 {article.share_clicks ?? 0}
                              </span>
                              <span className={styles.cardStock}>
                                {article.quantity} ud.
                              </span>
                            </div>
                          </div>
                          <div className={styles.cardActions}>
                            <button
                              type="button"
                              className={styles.cardOrderButton}
                              onClick={() => moveArticle(article.id, 'up', displayedArticles)}
                              aria-label="Subir"
                              title="Subir en esta categoría"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className={styles.cardOrderButton}
                              onClick={() => moveArticle(article.id, 'down', displayedArticles)}
                              aria-label="Bajar"
                              title="Bajar en esta categoría"
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
              ) : articles.length > 0 ? (
                <div className={styles.emptyState}>
                  <h2 className={styles.emptyTitle}>Sin artículos en esta categoría</h2>
                  <p className={styles.emptyText}>
                    Aún no has añadido artículos aquí. Crea uno y asígnalo a esta categoría.
                  </p>
                  <button
                    type="button"
                    className={styles.emptyButton}
                    onClick={() => setActiveTab('create')}
                  >
                    Crear artículo
                  </button>
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
          );
        })()}

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
                <p className={styles.categoryInstruction}>
                  Gestiona las categorías desde aquí. Puedes mostrar/ocultar categorías a los usuarios, y eliminar categorías enteras (no se pueden eliminar si contienen artículos asociados).
                </p>
                {categories.length > 0 ? (
                  <div className={styles.categoryGridCompact}>
                    {categories.map((cat) => {
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
        )}

        {/* Import CSV View */}
        {activeTab === 'import' && (
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
        )}
      </section>
    </main>
  );
}
