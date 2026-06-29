'use client';

import { useState, useRef, useEffect, ChangeEvent, FormEvent } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';
import { initialFormState, FormState, Article, Category, Sale, AdminTab } from '@/lib/types';
import styles from './admin.module.css';

// Hooks
import { useAdminData } from './hooks/useAdminData';

import dynamic from 'next/dynamic';

// Components
import AdminLogin from './components/AdminLogin';

const CatalogTab = dynamic(() => import('./components/CatalogTab'), { ssr: false });
const ArticleForm = dynamic(() => import('./components/ArticleForm'), { ssr: false });
const CategoriesManager = dynamic(() => import('./components/CategoriesManager'), { ssr: false });
const CSVImportTab = dynamic(() => import('./components/CSVImportTab'), { ssr: false });
const ConfigTab = dynamic(() => import('./components/ConfigTab'), { ssr: false });
const SalesTab = dynamic(() => import('./components/SalesTab'), { ssr: false });
const SalesCreateTab = dynamic(() => import('./components/SalesCreateTab'), { ssr: false });
const AnalyticsTab = dynamic(() => import('./components/AnalyticsTab'), { ssr: false });
const PDFListGenerator = dynamic(() => import('./components/PDFListGenerator'), { ssr: false });

// Image helpers
function getSafeFilePath(file: File) {
  const parts = file.name.split('.');
  const extension = parts.pop() || 'jpg';
  const baseName = parts.join('.');
  
  const cleanName = baseName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .replace(/_+/g, '_');
    
  const timestamp = Date.now();
  return `articles/${timestamp}_${cleanName}.${extension.toLowerCase()}`;
}

function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<File> {
  return new Promise(async (resolve) => {
    if (typeof window === 'undefined') {
      return resolve(file);
    }

    const fileNameLower = file.name.toLowerCase();
    const isHeic =
      fileNameLower.endsWith('.heic') ||
      fileNameLower.endsWith('.heif') ||
      file.type === 'image/heic' ||
      file.type === 'image/heif';

    if (!isHeic && !file.type.startsWith('image/')) {
      return resolve(file);
    }

    let fileToProcess = file;

    if (isHeic) {
      try {
        const heic2any = (await import('heic2any')).default;
        let convertedBlob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.8,
        });

        if (Array.isArray(convertedBlob)) {
          convertedBlob = convertedBlob[0];
        }

        const originalNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        fileToProcess = new File([convertedBlob], `${originalNameWithoutExt}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
      } catch (err) {
        console.error('Error converting HEIC to JPEG:', err);
      }
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
          return resolve(fileToProcess);
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(fileToProcess);
            }
            const originalNameWithoutExt = fileToProcess.name.replace(/\.[^/.]+$/, "");
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
      img.onerror = () => resolve(fileToProcess);
      img.src = (event.target?.result as string) || '';
    };
    reader.readAsDataURL(fileToProcess);
  });
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('catalog');
  
  // Custom hook containing shared admin state & operations
  const adminData = useAdminData();
  const {
    categories,
    setCategories,
    articles,
    setArticles,
    user,
    checkingAuth,
    loadingArticles,
    loadingCategories,
    hasVisibilityColumn,
    hasDiscountColumns,
    hasSettingsTable,
    paymentsEnabled,
    bizumEnabled,
    paypalEnabled,
    squareEnabled,
    hidePrices,
    hideAvailability,
    generalDiscountPercent,
    loadArticles,
    loadPaymentsSetting,
    reloadCategories,
    updateSetting,
  } = adminData;

  // Local form & modal states
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [files, setFiles] = useState<File[]>([]);
  const [frameFiles, setFrameFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [existingFrameImageUrls, setExistingFrameImageUrls] = useState<string[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  const [frameImagesToDelete, setFrameImagesToDelete] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatalogCategoryId, setSelectedCatalogCategoryId] = useState<number | null>(null);

  // Discount configuration sub-states
  const [selectedDiscountTarget, setSelectedDiscountTarget] = useState('');
  const [targetDiscountPercent, setTargetDiscountPercent] = useState('');
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [syncingCatalog, setSyncingCatalog] = useState(false);

  // Warning modal states
  const [showDiscountWarnModal, setShowDiscountWarnModal] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<{ isCreate: boolean; event: any } | null>(null);

  // Sales list state for Analytics
  const [sales, setSales] = useState<Sale[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const frameFileInputRef = useRef<HTMLInputElement | null>(null);

  const loadSales = async () => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error) {
        setSales(data ?? []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTabChange = (tab: AdminTab) => {
    resetForm();
    setActiveTab(tab);
    setSelectedCatalogCategoryId(null);
    setSearchQuery('');
    setSelectedDiscountTarget('');
    setTargetDiscountPercent('');
    if (tab === 'catalog' || tab === 'generate_list') {
      loadArticles();
      reloadCategories();
    } else if (tab === 'config') {
      loadPaymentsSetting();
    } else if (tab === 'analytics') {
      loadArticles();
      loadSales();
    }
  };

  const resetForm = () => {
    setFormState(initialFormState);
    setFiles([]);
    setFrameFiles([]);
    setEditingArticle(null);
    setExistingImageUrls([]);
    setImagesToDelete([]);
    setExistingFrameImageUrls([]);
    setFrameImagesToDelete([]);

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (frameFileInputRef.current) frameFileInputRef.current.value = '';
  };

  const updateField = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormState((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const updateFiles = (event: ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(event.target.files ?? []));
  };

  const updateFrameFiles = (event: ChangeEvent<HTMLInputElement>) => {
    setFrameFiles(Array.from(event.target.files ?? []));
  };

  const startEditing = (article: Article) => {
    setEditingArticle(article);
    setFormState({
      categoryId: String(article.category_id),
      marca: article.title.includes(' – ') ? article.title.split(' – ')[0] : article.title,
      modelo: article.title.includes(' – ') ? article.title.split(' – ').slice(1).join(' – ') : '',
      description: article.description ?? '',
      price: String(article.price),
      quantity: String(article.quantity),
      discountType: article.discount_type ?? '',
      discountValue: article.discount_value !== null && article.discount_value !== undefined ? String(article.discount_value) : '',
    });
    setExistingImageUrls(article.image_urls ?? []);
    setExistingFrameImageUrls(article.frame_image_urls ?? []);
    setImagesToDelete([]);
    setFrameImagesToDelete([]);
    setFiles([]);
    setFrameFiles([]);
    setActiveTab('edit');
  };

  const handleDeleteExistingImage = (url: string) => {
    setExistingImageUrls((current) => current.filter((u) => u !== url));
    setImagesToDelete((current) => [...current, url]);
  };

  const handleDeleteExistingFrameImage = (url: string) => {
    setExistingFrameImageUrls((current) => current.filter((u) => u !== url));
    setFrameImagesToDelete((current) => [...current, url]);
  };

  const moveImage = (index: number, direction: 'left' | 'right') => {
    setExistingImageUrls((current) => {
      const next = [...current];
      const swapIndex = direction === 'left' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= next.length) return current;
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next;
    });
  };

  const moveFrameImage = (index: number, direction: 'left' | 'right') => {
    setExistingFrameImageUrls((current) => {
      const next = [...current];
      const swapIndex = direction === 'left' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= next.length) return current;
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next;
    });
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert(`Error al cerrar sesión: ${error.message}`);
    } else {
      window.location.reload();
    }
  };

  // Move article up/down in ordering
  const moveArticle = async (articleId: number, direction: 'up' | 'down', contextArticles: Article[]) => {
    const idx = contextArticles.findIndex((a) => a.id === articleId);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= contextArticles.length) return;

    const a = contextArticles[idx];
    const b = contextArticles[swapIdx];

    const hasNullOrDuplicate = contextArticles.some((art, index) => 
      art.sort_order === null || 
      art.sort_order === undefined || 
      contextArticles.findIndex(o => o.sort_order === art.sort_order) !== index
    );

    if (hasNullOrDuplicate) {
      const updates = contextArticles.map((art, index) => {
        let targetOrder = index;
        if (index === idx) {
          targetOrder = swapIdx;
        } else if (index === swapIdx) {
          targetOrder = idx;
        }
        return { id: art.id, sort_order: targetOrder };
      });

      await Promise.all(
        updates.map((upd) =>
          supabase.from('articles').update({ sort_order: upd.sort_order }).eq('id', upd.id)
        )
      );

      setArticles((current) => {
        const updated = current.map((art) => {
          const upd = updates.find((u) => u.id === art.id);
          return upd ? { ...art, sort_order: upd.sort_order } : art;
        });
        return updated.sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0));
      });
    } else {
      const orderA = a.sort_order;
      const orderB = b.sort_order;

      await Promise.all([
        supabase.from('articles').update({ sort_order: orderB }).eq('id', a.id),
        supabase.from('articles').update({ sort_order: orderA }).eq('id', b.id),
      ]);

      setArticles((current) => {
        const updated = current.map((art) => {
          if (art.id === a.id) return { ...art, sort_order: orderB };
          if (art.id === b.id) return { ...art, sort_order: orderA };
          return art;
        });
        return updated.sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0));
      });
    }
  };

  async function deleteStorageImages(urls: string[]) {
    const paths = urls
      .map((url) => {
        const marker = '/product-images/';
        const index = url.indexOf(marker);
        return index !== -1 ? url.substring(index + marker.length) : null;
      })
      .filter((p): p is string => p !== null);

    if (paths.length > 0) {
      await supabase.storage.from('product-images').remove(paths);
    }
  }

  async function uploadImages() {
    const imageUrls: string[] = [];
    for (const file of files) {
      const compressedFile = await compressImage(file);
      const filePath = getSafeFilePath(compressedFile);
      await supabase.storage.from('product-images').upload(filePath, compressedFile, {
        cacheControl: '3600',
        upsert: false,
      });
      const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
      imageUrls.push(data.publicUrl);
    }
    return imageUrls;
  }

  async function uploadFrameImages() {
    const imageUrls: string[] = [];
    for (const file of frameFiles) {
      const compressedFile = await compressImage(file);
      const filePath = getSafeFilePath(compressedFile);
      await supabase.storage.from('product-images').upload(filePath, compressedFile, {
        cacheControl: '3600',
        upsert: false,
      });
      const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
      imageUrls.push(data.publicUrl);
    }
    return imageUrls;
  }

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const price = Number(formState.price);
    const quantity = Number.parseInt(formState.quantity, 10);

    if (!formState.categoryId || Number.isNaN(price) || Number.isNaN(quantity)) {
      alert('Por favor rellene los campos requeridos.');
      return;
    }

    const discountType = formState.discountType || null;
    const discountValue = formState.discountType ? Number(formState.discountValue) : null;
    const isZeroOrNegativePrice = discountType === 'amount' && discountValue !== null && price <= discountValue;

    if (isZeroOrNegativePrice) {
      setPendingSubmitData({ isCreate: true, event: null });
      setShowDiscountWarnModal(true);
      return;
    }

    executeCreate(false);
  };

  const executeCreate = async (deleteDiscount: boolean) => {
    const price = Number(formState.price);
    const quantity = Number.parseInt(formState.quantity, 10);
    setLoading(true);

    try {
      const imageUrls = await uploadImages();
      const frameImageUrls = await uploadFrameImages();
      const insertData: any = {
        category_id: Number(formState.categoryId),
        title: `${formState.marca.trim()} – ${formState.modelo.trim()}`,
        description: formState.description,
        price,
        quantity,
        image_urls: imageUrls,
        frame_image_urls: frameImageUrls,
      };

      if (hasDiscountColumns) {
        insertData.discount_type = deleteDiscount ? null : (formState.discountType || null);
        insertData.discount_value = deleteDiscount ? null : (formState.discountType ? Number(formState.discountValue) : null);
      }

      const { error } = await supabase.from('articles').insert(insertData);
      if (error) throw new Error(error.message);

      alert('Artículo creado correctamente.');
      resetForm();
      await loadArticles();
      setActiveTab('catalog');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al crear el artículo.');
    } finally {
      setLoading(false);
      setShowDiscountWarnModal(false);
      setPendingSubmitData(null);
    }
  };

  const handleUpdateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingArticle) return;

    const price = Number(formState.price);
    const quantity = Number.parseInt(formState.quantity, 10);

    if (!formState.categoryId || Number.isNaN(price) || Number.isNaN(quantity)) {
      alert('Por favor rellene los campos requeridos.');
      return;
    }

    const discountType = formState.discountType || null;
    const discountValue = formState.discountType ? Number(formState.discountValue) : null;

    const originalPrice = Number(editingArticle.price) || 0;
    const isPriceLowered = price < originalPrice;
    const hasDiscount = !!discountType;
    const isZeroOrNegativePrice = discountType === 'amount' && discountValue !== null && price <= discountValue;

    if ((isPriceLowered && hasDiscount) || isZeroOrNegativePrice) {
      setPendingSubmitData({ isCreate: false, event: null });
      setShowDiscountWarnModal(true);
      return;
    }

    executeUpdate(false);
  };

  const executeUpdate = async (deleteDiscount: boolean) => {
    if (!editingArticle) return;
    const price = Number(formState.price);
    const quantity = Number.parseInt(formState.quantity, 10);
    setLoading(true);

    try {
      const newUrls = await uploadImages();
      const finalImageUrls = [...existingImageUrls, ...newUrls];

      const newFrameUrls = await uploadFrameImages();
      const finalFrameImageUrls = [...existingFrameImageUrls, ...newFrameUrls];

      const updateData: any = {
        category_id: Number(formState.categoryId),
        title: `${formState.marca.trim()} – ${formState.modelo.trim()}`,
        description: formState.description,
        price,
        quantity,
        image_urls: finalImageUrls,
        frame_image_urls: finalFrameImageUrls,
      };

      if (hasDiscountColumns) {
        updateData.discount_type = deleteDiscount ? null : (formState.discountType || null);
        updateData.discount_value = deleteDiscount ? null : (formState.discountType ? Number(formState.discountValue) : null);
      }

      const { error } = await supabase
        .from('articles')
        .update(updateData)
        .eq('id', editingArticle.id);

      if (error) throw new Error(error.message);

      const allImagesToDelete = [...imagesToDelete, ...frameImagesToDelete];
      if (allImagesToDelete.length > 0) {
        await deleteStorageImages(allImagesToDelete);
      }

      alert('Artículo actualizado correctamente.');
      resetForm();
      await loadArticles();
      setActiveTab('catalog');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al actualizar el artículo.');
    } finally {
      setLoading(false);
      setShowDiscountWarnModal(false);
      setPendingSubmitData(null);
    }
  };

  const handleDelete = async () => {
    if (!editingArticle) return;
    const confirmed = confirm('¿Estás seguro de que deseas eliminar este artículo de forma permanente? Esta acción no se puede deshacer.');
    if (!confirmed) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('articles')
        .delete()
        .eq('id', editingArticle.id);

      if (error) throw new Error(error.message);

      const urlsToDelete = [...(editingArticle.image_urls ?? []), ...(editingArticle.frame_image_urls ?? [])];
      if (urlsToDelete.length > 0) {
        await deleteStorageImages(urlsToDelete);
      }

      alert('Artículo eliminado correctamente.');
      resetForm();
      await loadArticles();
      setActiveTab('catalog');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al eliminar el artículo.');
    } finally {
      setLoading(false);
    }
  };

  // Discount save/delete config helpers
  const handleSaveDiscount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedDiscountTarget) return;

    setSavingDiscount(true);
    try {
      if (selectedDiscountTarget === 'general') {
        const val = targetDiscountPercent.trim();
        const { error } = await supabase
          .from('settings')
          .upsert({ key: 'general_discount_percent', value: val });

        if (error) throw new Error(error.message);
        adminData.setGeneralDiscountPercent(val);
        alert('Descuento general guardado correctamente.');
      } else if (selectedDiscountTarget.startsWith('cat-')) {
        const catId = Number(selectedDiscountTarget.substring(4));
        const val = targetDiscountPercent.trim() ? Number(targetDiscountPercent) : null;
        
        const { error } = await supabase
          .from('categories')
          .update({ discount_percent: val })
          .eq('id', catId);

        if (error) throw new Error(error.message);

        setCategories(prev => prev.map(c => c.id === catId ? { ...c, discount_percent: val } : c));
        alert('Descuento de categoría guardado correctamente.');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar el descuento.');
    } finally {
      setSavingDiscount(false);
    }
  };

  const handleDeleteDiscount = async (target: 'general' | number) => {
    const confirmed = confirm(
      target === 'general'
        ? '¿Estás seguro de que deseas eliminar el descuento general?'
        : '¿Estás seguro de que deseas eliminar el descuento de esta categoría?'
    );
    if (!confirmed) return;

    setSavingDiscount(true);
    try {
      if (target === 'general') {
        const { error } = await supabase
          .from('settings')
          .upsert({ key: 'general_discount_percent', value: '' });

        if (error) throw new Error(error.message);
        adminData.setGeneralDiscountPercent('');
        if (selectedDiscountTarget === 'general') {
          setTargetDiscountPercent('');
        }
        alert('Descuento general eliminado correctamente.');
      } else {
        const { error } = await supabase
          .from('categories')
          .update({ discount_percent: null })
          .eq('id', target);

        if (error) throw new Error(error.message);

        setCategories(prev => prev.map(c => c.id === target ? { ...c, discount_percent: null } : c));
        if (selectedDiscountTarget === `cat-${target}`) {
          setTargetDiscountPercent('');
        }
        alert('Descuento de categoría eliminado correctamente.');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar el descuento.');
    } finally {
      setSavingDiscount(false);
    }
  };

  const handleSyncSquareCatalog = async () => {
    setSyncingCatalog(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error('No se encontró sesión activa.');
      }

      const res = await fetch('/api/admin/sync-square-catalog', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al sincronizar el catálogo.');
      }

      if (data.syncedCount > 0) {
        alert(`¡Sincronización completada con éxito!\n- Sincronizados: ${data.syncedCount} artículos.\n- Fallidos: ${data.failedCount || 0}`);
        await loadArticles();
      } else {
        alert(data.message || 'Todos los artículos ya están sincronizados.');
      }
    } catch (err: any) {
      alert(`Error de sincronización: ${err.message || err}`);
    } finally {
      setSyncingCatalog(false);
    }
  };

  if (checkingAuth) {
    return (
      <main className={styles.page}>
        <div className={styles.loading}>Verificando sesión...</div>
      </main>
    );
  }

  if (!user) {
    return <AdminLogin onLoginSuccess={() => window.location.reload()} />;
  }

  return (
    <>
      <main className={`${styles.page} no-print`}>
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
                    : activeTab === 'config'
                    ? 'Configuración'
                    : activeTab === 'sales'
                    ? 'Historial de Ventas'
                    : activeTab === 'sales-create'
                    ? 'Registrar Nueva Venta'
                    : activeTab === 'analytics'
                    ? 'Estadísticas del Catálogo'
                    : activeTab === 'generate_list'
                    ? 'Generar Listado PDF'
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
                    : activeTab === 'config'
                    ? 'Configura opciones globales del catálogo, como ocultar precios o disponibilidad.'
                    : activeTab === 'sales'
                    ? 'Consulta las ventas realizadas, gestiona precompras y visualiza o descarga facturas.'
                    : activeTab === 'sales-create'
                    ? 'Registra una venta manual indicando los artículos, cantidades, precios y detalles de pago.'
                    : activeTab === 'analytics'
                    ? 'Analiza el rendimiento del catálogo, visitas, clics de contacto e ingresos por ventas.'
                    : activeTab === 'generate_list'
                    ? 'Configura y genera un listado de inventario en PDF de los artículos.'
                    : 'Modifica los campos del artículo, gestiona sus imágenes o bórralo permanentemente.'}
                </p>
              </div>
            </div>

            <div className={styles.headerRight}>
              <button
                type="button"
                onClick={handleLogout}
                className={styles.logoutButton}
              >
                Cerrar sesión
              </button>
              <div className={styles.status}>
                <span className={styles.statusValue}>
                  {loadingArticles ? '...' : articles.length}
                </span>
                <span className={styles.statusLabel}>artículos en catálogo</span>
              </div>
            </div>
          </header>

          {/* Action buttons (above tabs) */}
          <div className={styles.actionBar}>
            <div className={styles.actionBarLeft}>
              <button
                type="button"
                className={`${styles.actionButton} ${styles.actionButtonBlue} ${activeTab === 'sales-create' ? styles.actionButtonActive : ''}`}
                onClick={() => handleTabChange('sales-create')}
              >
                Registrar nueva venta
              </button>
            </div>
            <div className={styles.actionBarRight}>
              <button
                type="button"
                className={`${styles.actionButton} ${styles.actionButtonGreen} ${activeTab === 'create' ? styles.actionButtonActive : ''}`}
                onClick={() => handleTabChange('create')}
              >
                + Nuevo Artículo
              </button>
              <button
                type="button"
                className={`${styles.actionButton} ${styles.actionButtonYellow} ${activeTab === 'import' ? styles.actionButtonActive : ''}`}
                onClick={() => handleTabChange('import')}
              >
                ↑ Importar CSV
              </button>
            </div>
          </div>

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
              <button
                type="button"
                className={`${styles.tab} ${activeTab === 'config' ? styles.tabActive : ''}`}
                onClick={() => handleTabChange('config')}
              >
                Configuración
              </button>
              <button
                type="button"
                className={`${styles.tab} ${activeTab === 'sales' ? styles.tabActive : ''}`}
                onClick={() => handleTabChange('sales')}
              >
                Ventas
              </button>
              <button
                type="button"
                className={`${styles.tab} ${activeTab === 'analytics' ? styles.tabActive : ''}`}
                onClick={() => handleTabChange('analytics')}
              >
                Estadísticas
              </button>
              <button
                type="button"
                className={`${styles.tab} ${activeTab === 'generate_list' ? styles.tabActive : ''}`}
                onClick={() => handleTabChange('generate_list')}
              >
                Generar lista
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
          </nav>

          {/* Tab Views */}
          {activeTab === 'catalog' && (
            <CatalogTab
              articles={articles}
              categories={categories}
              loadingArticles={loadingArticles}
              selectedCatalogCategoryId={selectedCatalogCategoryId}
              setSelectedCatalogCategoryId={setSelectedCatalogCategoryId}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              setActiveTab={setActiveTab}
              moveArticle={moveArticle}
              startEditing={startEditing}
            />
          )}

          {(activeTab === 'create' || activeTab === 'edit') && (
            <ArticleForm
              mode={activeTab}
              formState={formState}
              updateField={updateField}
              setFormState={setFormState}
              categories={categories}
              loadingCategories={loadingCategories}
              loading={loading}
              hasDiscountColumns={hasDiscountColumns}
              generalDiscountPercent={generalDiscountPercent}
              files={files}
              frameFiles={frameFiles}
              fileInputRef={fileInputRef}
              frameFileInputRef={frameFileInputRef}
              updateFiles={updateFiles}
              updateFrameFiles={updateFrameFiles}
              editingArticle={editingArticle}
              existingImageUrls={existingImageUrls}
              existingFrameImageUrls={existingFrameImageUrls}
              handleDeleteExistingImage={handleDeleteExistingImage}
              handleDeleteExistingFrameImage={handleDeleteExistingFrameImage}
              moveImage={moveImage}
              moveFrameImage={moveFrameImage}
              onSubmit={activeTab === 'create' ? handleCreateSubmit : handleUpdateSubmit}
              onDelete={handleDelete}
              onCancel={() => handleTabChange('catalog')}
              onReset={resetForm}
            />
          )}

          {activeTab === 'categories' && (
            <CategoriesManager
              categories={categories}
              articles={articles}
              user={user}
              hasVisibilityColumn={hasVisibilityColumn}
              reloadCategories={reloadCategories}
            />
          )}

          {activeTab === 'import' && (
            <CSVImportTab
              categories={categories}
              articles={articles}
              loadArticles={loadArticles}
              handleTabChange={handleTabChange}
            />
          )}

          {activeTab === 'config' && (
            <ConfigTab
              paymentsEnabled={paymentsEnabled}
              bizumEnabled={bizumEnabled}
              paypalEnabled={paypalEnabled}
              squareEnabled={squareEnabled}
              hidePrices={hidePrices}
              hideAvailability={hideAvailability}
              loadingPaymentsSetting={loadingArticles}
              hasSettingsTable={hasSettingsTable}
              hasDiscountColumns={hasDiscountColumns}
              generalDiscountPercent={generalDiscountPercent}
              categories={categories}
              articles={articles}
              togglePayments={(enabled) => updateSetting('payments_enabled', String(enabled))}
              toggleBizum={(enabled) => updateSetting('bizum_enabled', String(enabled))}
              togglePaypal={(enabled) => updateSetting('paypal_enabled', String(enabled))}
              toggleSquare={(enabled) => updateSetting('square_payments_enabled', String(enabled))}
              toggleHidePrices={(enabled) => updateSetting('hide_prices', String(enabled))}
              toggleHideAvailability={(enabled) => updateSetting('hide_availability', String(enabled))}
              loadPaymentsSetting={loadPaymentsSetting}
              handleSaveDiscount={handleSaveDiscount}
              handleDeleteDiscount={handleDeleteDiscount}
              selectedDiscountTarget={selectedDiscountTarget}
              setSelectedDiscountTarget={setSelectedDiscountTarget}
              targetDiscountPercent={targetDiscountPercent}
              setTargetDiscountPercent={setTargetDiscountPercent}
              savingDiscount={savingDiscount}
              setCategories={setCategories}
              syncingCatalog={syncingCatalog}
              handleSyncSquareCatalog={handleSyncSquareCatalog}
            />

          )}

          {activeTab === 'sales' && (
            <SalesTab
              articles={articles}
              loadArticles={loadArticles}
            />
          )}

          {activeTab === 'sales-create' && (
            <SalesCreateTab
              articles={articles}
              categories={categories}
              generalDiscountPercent={generalDiscountPercent}
              loadArticles={loadArticles}
              handleTabChange={handleTabChange}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsTab
              articles={articles}
              sales={sales}
              loadArticles={loadArticles}
            />
          )}

          {activeTab === 'generate_list' && (
            <PDFListGenerator
              articles={articles}
              categories={categories}
              generalDiscountPercent={generalDiscountPercent}
            />
          )}
        </section>
      </main>

      {/* Warning Modal: Zero/Negative price due to discounts */}
      {showDiscountWarnModal && pendingSubmitData && (() => {
        const newPrice = Number(formState.price) || 0;
        const discountVal = Number(formState.discountValue) || 0;
        let finalPriceWithDiscount = newPrice;
        if (formState.discountType === 'percentage') {
          finalPriceWithDiscount = Math.max(0, newPrice * (1 - discountVal / 100));
        } else if (formState.discountType === 'amount') {
          finalPriceWithDiscount = Math.max(0, newPrice - discountVal);
        }
        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}>
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚠️ Ajuste de Descuento
              </h3>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                Este artículo tiene un descuento aplicado. Si bajas el precio, su nuevo precio final con el descuento será <strong>{formatPrice(finalPriceWithDiscount)}</strong>.
                <br /><br />
                Eliminando el descuento, su precio final será: <strong>{formatPrice(newPrice)}</strong>.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={async () => {
                    if (pendingSubmitData.isCreate) {
                      await executeCreate(false);
                    } else {
                      await executeUpdate(false);
                    }
                  }}
                  className={`${styles.dangerButton} ${styles.solidRedButton}`}
                  style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '800', textWrap: 'nowrap' }}
                >
                  Continuar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (pendingSubmitData.isCreate) {
                      await executeCreate(true);
                    } else {
                      await executeUpdate(true);
                    }
                  }}
                  className={`${styles.primaryButton} ${styles.solidGreenButton}`}
                  style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '800', border: 'none', textWrap: 'nowrap' }}
                >
                  Eliminar descuento actual
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDiscountWarnModal(false);
                    setPendingSubmitData(null);
                  }}
                  className={`${styles.secondaryButton} ${styles.solidGrayButton}`}
                  style={{ width: '100%', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '800', marginTop: '4px' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
