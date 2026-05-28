'use client';

import { supabase } from '@/lib/supabase';
import { getFlagEmoji, isValidISOCode } from '@/lib/utils';
import { User } from '@supabase/supabase-js';
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import styles from './admin.module.css';
import Image from 'next/image';
import { calculateDiscount } from '@/lib/discounts';

type Category = {
  id: number;
  name: string;
  country_code: string;
  is_visible?: boolean;
  discount_percent?: number | null;
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
  views?: number;
  discount_type?: string | null;
  discount_value?: number | null;
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
  discountType: string;
  discountValue: string;
};

const initialFormState: FormState = {
  categoryId: '',
  marca: '',
  modelo: '',
  description: '',
  price: '',
  quantity: '1',
  discountType: '',
  discountValue: '',
};

function getSafeFilePath(file: File) {
  const parts = file.name.split('.');
  const extension = parts.pop() || 'jpg';
  const baseName = parts.join('.');
  
  // Normalizar y limpiar caracteres no permitidos en URLs, pero manteniendo el nombre original
  const cleanName = baseName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-zA-Z0-9-_]/g, '_') // Reemplazar caracteres especiales y espacios por guiones bajos
    .replace(/_+/g, '_'); // Evitar guiones bajos duplicados
    
  // Para evitar errores por nombres duplicados al subir imágenes de diferentes artículos (ej: frontal.jpg),
  // se le añade un prefijo único con la marca de tiempo (timestamp).
  const timestamp = Date.now();
  const fileName = `${timestamp}_${cleanName}.${extension.toLowerCase()}`;

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
  const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [activeTab, setActiveTab] = useState<'catalog' | 'create' | 'edit' | 'categories' | 'import' | 'config' | 'sales' | 'sales-create'>('catalog');
  
  // Sales management states
  const [sales, setSales] = useState<any[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [salesSubmenu, setSalesSubmenu] = useState<'all' | 'prepurchase' | 'completed'>('all');
  const [salesSearch, setSalesSearch] = useState('');
  const [salesFilterPayment, setSalesFilterPayment] = useState<'all' | 'REVOLUT' | 'PAYPAL' | 'EFECTIVO'>('all');
  const [salesFilterStatus, setSalesFilterStatus] = useState<'all' | 'COMPLETADA' | 'PRECOMPRA'>('all');
  const [salesFilterDate, setSalesFilterDate] = useState<'all' | 'today' | 'week' | 'month'>('all');
  
  // Sale detail viewer modal
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<any | null>(null);
  const [saleDetailItems, setSaleDetailItems] = useState<any[]>([]);
  const [loadingSaleItems, setLoadingSaleItems] = useState(false);

  // Sales creation states
  const [selectedArticleIds, setSelectedArticleIds] = useState<number[]>([]);
  const [saleItemQuantities, setSaleItemQuantities] = useState<Map<number, number>>(new Map());
  const [saleItemPrices, setSaleItemPrices] = useState<Map<number, number>>(new Map());
  const [saleBuyerPhoneCode, setSaleBuyerPhoneCode] = useState('+34');
  const [saleBuyerPhone, setSaleBuyerPhone] = useState('');
  const [saleBuyerEmail, setSaleBuyerEmail] = useState('');
  const [saleLocation, setSaleLocation] = useState('online');
  const [salePaymentType, setSalePaymentType] = useState<'REVOLUT' | 'PAYPAL' | 'EFECTIVO'>('REVOLUT');
  const [showSaleSummary, setShowSaleSummary] = useState(false);
  const [registeringSale, setRegisteringSale] = useState(false);
  const [salesCreateSearch, setSalesCreateSearch] = useState('');
  
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [hasVisibilityColumn, setHasVisibilityColumn] = useState(true);

  // Discount states
  const [hasDiscountColumns, setHasDiscountColumns] = useState(true);
  const [generalDiscountPercent, setGeneralDiscountPercent] = useState('');
  const [selectedDiscountTarget, setSelectedDiscountTarget] = useState(''); // 'general' or 'cat-[id]'
  const [targetDiscountPercent, setTargetDiscountPercent] = useState('');
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [showDiscountWarnModal, setShowDiscountWarnModal] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<{ isCreate: boolean; event: any } | null>(null);

  // Search & Payments States
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [revolutEnabled, setRevolutEnabled] = useState(true);
  const [paypalEnabled, setPaypalEnabled] = useState(true);
  const [hidePrices, setHidePrices] = useState(false);
  const [hideAvailability, setHideAvailability] = useState(false);
  const [loadingPaymentsSetting, setLoadingPaymentsSetting] = useState(true);
  const [hasSettingsTable, setHasSettingsTable] = useState(true);

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
  const [categoryLogo, setCategoryLogo] = useState<File | null>(null);
  const [logoInputKey, setLogoInputKey] = useState(Date.now());
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
        .select('id, name, country_code, is_visible, discount_percent')
        .order('id', { ascending: true });

      if (error) {
        if (error.message.includes('discount_percent')) {
          setHasDiscountColumns(false);
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('categories')
            .select('id, name, country_code, is_visible')
            .order('id', { ascending: true });

          if (fallbackError) {
            if (fallbackError.message.includes('is_visible')) {
              setHasVisibilityColumn(false);
              const { data: doubleFallback, error: doubleError } = await supabase
                .from('categories')
                .select('id, name, country_code')
                .order('id', { ascending: true });
              if (doubleError) {
                alert(`Could not load categories: ${doubleError.message}`);
                setCategories([]);
              } else {
                setCategories((doubleFallback ?? []).map(c => ({ ...c, is_visible: true, discount_percent: null })));
              }
            } else {
              alert(`Could not load categories: ${fallbackError.message}`);
              setCategories([]);
            }
          } else {
            setCategories((fallbackData ?? []).map(c => ({ ...c, discount_percent: null })));
          }
        } else if (error.message.includes('is_visible')) {
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
                discount_percent: null
              }))
            );
          }
        } else {
          alert(`Could not load categories: ${error.message}`);
          setCategories([]);
        }
      } else {
        setHasDiscountColumns(true);
        setHasVisibilityColumn(true);
        setCategories(data ?? []);
      }

      setLoadingCategories(false);
    }

    loadCategories();
    loadArticles();
    loadPaymentsSetting();
  }, [user]);

  async function loadPaymentsSetting() {
    setLoadingPaymentsSetting(true);
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value');

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('settings')) {
          setHasSettingsTable(false);
        } else {
          console.error('Error fetching payments settings:', error);
        }
        setPaymentsEnabled(false);
        setRevolutEnabled(true);
        setPaypalEnabled(true);
        setHidePrices(false);
        setHideAvailability(false);
        setGeneralDiscountPercent('');
      } else if (data && data.length > 0) {
        const settingsMap = new Map(data.map((s) => [s.key, s.value]));
        setPaymentsEnabled(settingsMap.get('payments_enabled') === 'true');
        setRevolutEnabled(settingsMap.get('revolut_enabled') !== 'false');
        setPaypalEnabled(settingsMap.get('paypal_enabled') !== 'false');
        setHidePrices(settingsMap.get('hide_prices') === 'true');
        setHideAvailability(settingsMap.get('hide_availability') === 'true');
        setGeneralDiscountPercent(settingsMap.get('general_discount_percent') || '');
        setHasSettingsTable(true);
      } else {
        setPaymentsEnabled(false);
        setRevolutEnabled(true);
        setPaypalEnabled(true);
        setHidePrices(false);
        setHideAvailability(false);
        setGeneralDiscountPercent('');
        setHasSettingsTable(true);
      }
    } catch (e) {
      console.error(e);
      setPaymentsEnabled(false);
      setRevolutEnabled(true);
      setPaypalEnabled(true);
      setHidePrices(false);
      setHideAvailability(false);
      setGeneralDiscountPercent('');
    } finally {
      setLoadingPaymentsSetting(false);
    }
  }

  async function updateSetting(key: string, value: string) {
    if (!hasSettingsTable) {
      alert("La tabla 'settings' no existe en la base de datos. Ejecuta el script SQL en Supabase para poder guardar.");
      return;
    }

    setLoadingPaymentsSetting(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ key, value });

      if (error) {
        alert(`Error al guardar ajuste: ${error.message}`);
      } else {
        if (key === 'payments_enabled') setPaymentsEnabled(value === 'true');
        if (key === 'revolut_enabled') setRevolutEnabled(value === 'true');
        if (key === 'paypal_enabled') setPaypalEnabled(value === 'true');
        if (key === 'hide_prices') setHidePrices(value === 'true');
        if (key === 'hide_availability') setHideAvailability(value === 'true');
      }
    } catch (e) {
      console.error(e);
      alert('Error de red al intentar guardar.');
    } finally {
      setLoadingPaymentsSetting(false);
    }
  }

  function getFinalPriceForArticle(article: Article) {
    const category = categories.find((c) => c.id === article.category_id);
    return calculateDiscount(
      article.price,
      article.discount_type,
      article.discount_value,
      category?.discount_percent,
      generalDiscountPercent
    ).finalPrice;
  }

  async function loadSales() {
    setLoadingSales(true);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading sales:', error);
      } else {
        setSales(data ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSales(false);
    }
  }

  async function fetchSaleItems(saleId: string) {
    setLoadingSaleItems(true);
    try {
      const { data, error } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', saleId);

      if (error) {
        console.error('Error fetching sale items:', error);
      } else {
        setSaleDetailItems(data ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSaleItems(false);
    }
  }

  function viewSaleDetail(sale: any) {
    setSelectedSaleDetail(sale);
    fetchSaleItems(sale.id);
  }

  async function completePrepurchaseItem(item: any) {
    try {
      const { error: itemError } = await supabase
        .from('sale_items')
        .update({ is_prepurchase: false })
        .eq('id', item.id);

      if (itemError) throw itemError;

      if (item.article_id) {
        const { data: artData } = await supabase
          .from('articles')
          .select('quantity')
          .eq('id', item.article_id)
          .single();

        const currentQty = artData ? artData.quantity : 0;

        const { error: stockError } = await supabase
          .from('articles')
          .update({ quantity: currentQty + 1 })
          .eq('id', item.article_id);

        if (stockError) {
          console.error('Error updating stock on prepurchase completion:', stockError);
        }
      }

      const updatedItems = saleDetailItems.map((it) =>
        it.id === item.id ? { ...it, is_prepurchase: false } : it
      );
      setSaleDetailItems(updatedItems);

      const anyRemainingPrepurchase = updatedItems.some((it) => it.is_prepurchase);

      if (!anyRemainingPrepurchase) {
        const { error: saleError } = await supabase
          .from('sales')
          .update({ status: 'COMPLETADA' })
          .eq('id', selectedSaleDetail.id);

        if (saleError) {
          console.error('Error updating sale status to COMPLETADA:', saleError);
        } else {
          setSelectedSaleDetail({ ...selectedSaleDetail, status: 'COMPLETADA' });
          alert('¡El artículo ha sido completado y la venta ha sido marcada como COMPLETADA!');
        }
      } else {
        alert('Artículo completado. Aún quedan otros artículos en precompra para este pedido.');
      }

      await loadSales();
      await loadArticles();
    } catch (e: any) {
      alert(`Error al completar el artículo: ${e.message || e}`);
    }
  }

  async function handleRegisterSale() {
    if (selectedArticleIds.length === 0) {
      alert('Debes seleccionar al menos un artículo.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (saleBuyerEmail.trim() && !emailRegex.test(saleBuyerEmail.trim())) {
      alert('Por favor introduce un email válido.');
      return;
    }

    const phoneRegex = /^[0-9\s\-()+]+$/;
    if (saleBuyerPhone.trim() && !phoneRegex.test(saleBuyerPhone.trim())) {
      alert('Por favor introduce un teléfono válido (solo números y espacios).');
      return;
    }

    setRegisteringSale(true);
    try {
      let totalPrice = 0;
      let totalArticlesCount = 0;
      let hasPrepurchase = false;

      const itemsToInsert: any[] = [];
      const stockUpdates: Array<{ id: number; quantity: number }> = [];

      for (const id of selectedArticleIds) {
        const article = articles.find((a) => a.id === id);
        if (!article) continue;

        const qty = saleItemQuantities.get(id) || 1;
        const customPrice = saleItemPrices.has(id)
          ? (saleItemPrices.get(id) ?? 0)
          : getFinalPriceForArticle(article);

        const isPrepurchase = qty > article.quantity;
        if (isPrepurchase) {
          hasPrepurchase = true;
        }

        totalPrice += customPrice * qty;
        totalArticlesCount += qty;

        itemsToInsert.push({
          article_id: id,
          title: article.title,
          quantity: qty,
          price: customPrice,
          is_prepurchase: isPrepurchase,
        });

        stockUpdates.push({
          id,
          quantity: article.quantity - qty,
        });
      }

      const fullPhoneNumber = saleBuyerPhone.trim()
        ? `${saleBuyerPhoneCode}${saleBuyerPhone.trim()}`
        : '';

      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          buyer_phone: fullPhoneNumber || null,
          buyer_email: saleBuyerEmail.trim() || null,
          location: saleLocation.trim() || 'online',
          payment_type: salePaymentType,
          total_price: totalPrice,
          total_articles: totalArticlesCount,
          status: hasPrepurchase ? 'PRECOMPRA' : 'COMPLETADA',
        })
        .select()
        .single();

      if (saleError || !saleData) {
        throw new Error(`Error al registrar la venta: ${saleError?.message}`);
      }

      const itemsWithSaleId = itemsToInsert.map((item) => ({
        ...item,
        sale_id: saleData.id,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(itemsWithSaleId);

      if (itemsError) {
        throw new Error(`Error al registrar los detalles de la venta: ${itemsError.message}`);
      }

      for (const update of stockUpdates) {
        const { error: stockError } = await supabase
          .from('articles')
          .update({ quantity: update.quantity })
          .eq('id', update.id);

        if (stockError) {
          console.error(`Error updating stock for article ID ${update.id}:`, stockError);
        }
      }

      alert('¡Venta registrada con éxito!');
      setShowSaleSummary(false);
      
      await loadArticles();
      handleTabChange('sales');
    } catch (e: any) {
      alert(e.message || 'Error al guardar la venta.');
    } finally {
      setRegisteringSale(false);
    }
  }

  async function togglePayments(enabled: boolean) {
    await updateSetting('payments_enabled', String(enabled));
  }

  async function toggleRevolut(enabled: boolean) {
    await updateSetting('revolut_enabled', String(enabled));
  }

  async function togglePaypal(enabled: boolean) {
    await updateSetting('paypal_enabled', String(enabled));
  }

  async function toggleHidePrices(enabled: boolean) {
    await updateSetting('hide_prices', String(enabled));
  }

  async function toggleHideAvailability(enabled: boolean) {
    await updateSetting('hide_availability', String(enabled));
  }

  async function loadArticles() {
    setLoadingArticles(true);
    const { data, error } = await supabase
      .from('articles')
      .select('id, category_id, title, description, price, quantity, image_urls, sort_order, contact_clicks, share_clicks, views, discount_type, discount_value')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      if (error.message.includes('discount_type') || error.message.includes('discount_value')) {
        setHasDiscountColumns(false);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('articles')
          .select('id, category_id, title, description, price, quantity, image_urls, sort_order, contact_clicks, share_clicks, views')
          .order('sort_order', { ascending: true })
          .order('id', { ascending: true });
        if (fallbackError) {
          alert(`Could not load articles: ${fallbackError.message}`);
        } else {
          setArticles((fallbackData ?? []).map(a => ({ ...a, discount_type: null, discount_value: null })));
        }
      } else {
        alert(`Could not load articles: ${error.message}`);
      }
    } else {
      setArticles(data ?? []);
    }
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

  function handleTabChange(tab: 'catalog' | 'create' | 'categories' | 'import' | 'config' | 'sales' | 'sales-create') {
    resetForm();
    setActiveTab(tab);
    setSelectedCatalogCategoryId(null);
    setSearchQuery('');
    setCsvRows([]);
    setCsvFileName('');
    setCsvImportResults(null);
    setSelectedDiscountTarget('');
    setTargetDiscountPercent('');
    if (tab === 'catalog') {
      loadArticles();
    } else if (tab === 'config') {
      loadPaymentsSetting();
    } else if (tab === 'sales') {
      loadSales();
    } else if (tab === 'sales-create') {
      setSelectedArticleIds([]);
      setSaleItemQuantities(new Map());
      setSaleItemPrices(new Map());
      setSaleBuyerPhone('');
      setSaleBuyerEmail('');
      setSaleLocation('online');
      setSalePaymentType('REVOLUT');
      setSalesCreateSearch('');
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
      discountType: article.discount_type ?? '',
      discountValue: article.discount_value !== null && article.discount_value !== undefined ? String(article.discount_value) : '',
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

    const discountType = formState.discountType || null;
    const discountValue = formState.discountType ? Number(formState.discountValue) : null;

    const isZeroOrNegativePrice = discountType === 'amount' && discountValue !== null && price <= discountValue;

    if (isZeroOrNegativePrice) {
      setPendingSubmitData({ isCreate: true, event: null });
      setShowDiscountWarnModal(true);
      return;
    }

    await executeCreate(false);
  }

  async function executeCreate(deleteDiscount: boolean) {
    const price = Number(formState.price);
    const quantity = Number.parseInt(formState.quantity, 10);
    setLoading(true);

    try {
      const imageUrls = await uploadImages();
      const insertData: any = {
        category_id: Number(formState.categoryId),
        title: `${formState.marca.trim()} – ${formState.modelo.trim()}`,
        description: formState.description,
        price,
        quantity,
        image_urls: imageUrls,
      };

      if (hasDiscountColumns) {
        insertData.discount_type = deleteDiscount ? null : (formState.discountType || null);
        insertData.discount_value = deleteDiscount ? null : (formState.discountType ? Number(formState.discountValue) : null);
      }

      const { error } = await supabase.from('articles').insert(insertData);

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
      setShowDiscountWarnModal(false);
      setPendingSubmitData(null);
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

    const discountType = formState.discountType || null;
    const discountValue = formState.discountType ? Number(formState.discountValue) : null;

    const originalPrice = editingArticle ? Number(editingArticle.price) || 0 : 0;
    const isPriceLowered = editingArticle && price < originalPrice;
    const hasDiscount = !!discountType;
    const isZeroOrNegativePrice = discountType === 'amount' && discountValue !== null && price <= discountValue;

    if ((isPriceLowered && hasDiscount) || isZeroOrNegativePrice) {
      setPendingSubmitData({ isCreate: false, event: null });
      setShowDiscountWarnModal(true);
      return;
    }

    await executeUpdate(false);
  }

  async function executeUpdate(deleteDiscount: boolean) {
    if (!editingArticle) return;
    const price = Number(formState.price);
    const quantity = Number.parseInt(formState.quantity, 10);
    setLoading(true);

    try {
      const newUrls = await uploadImages();
      const finalImageUrls = [...existingImageUrls, ...newUrls];

      const updateData: any = {
        category_id: Number(formState.categoryId),
        title: `${formState.marca.trim()} – ${formState.modelo.trim()}`,
        description: formState.description,
        price,
        quantity,
        image_urls: finalImageUrls,
      };

      if (hasDiscountColumns) {
        updateData.discount_type = deleteDiscount ? null : (formState.discountType || null);
        updateData.discount_value = deleteDiscount ? null : (formState.discountType ? Number(formState.discountValue) : null);
      }

      const { error } = await supabase
        .from('articles')
        .update(updateData)
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
      setShowDiscountWarnModal(false);
      setPendingSubmitData(null);
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
      window.location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al crear la categoría.');
    } finally {
      setCategoryLoading(false);
    }
  }

  async function reloadCategories() {
    const { data: catData, error: catError } = await supabase
      .from('categories')
      .select('id, name, country_code, is_visible, discount_percent')
      .order('id', { ascending: true });

    if (catError) {
      if (catError.message.includes('discount_percent')) {
        setHasDiscountColumns(false);
        const { data: fallbackCatData, error: fallbackCatError } = await supabase
          .from('categories')
          .select('id, name, country_code, is_visible')
          .order('id', { ascending: true });

        if (fallbackCatError) {
          if (fallbackCatError.message.includes('is_visible')) {
            setHasVisibilityColumn(false);
            const { data: doubleFallback, error: doubleError } = await supabase
              .from('categories')
              .select('id, name, country_code')
              .order('id', { ascending: true });
            if (doubleError) throw new Error(doubleError.message);
            setCategories((doubleFallback ?? []).map(c => ({ ...c, is_visible: true, discount_percent: null })));
          } else {
            throw new Error(fallbackCatError.message);
          }
        } else {
          setCategories((fallbackCatData ?? []).map(c => ({ ...c, discount_percent: null })));
        }
        return;
      }
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
            discount_percent: null
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

  async function handleSaveDiscount(event: FormEvent) {
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
        setGeneralDiscountPercent(val);
        alert('Descuento general guardado correctamente.');
      } else if (selectedDiscountTarget.startsWith('cat-')) {
        const catId = Number(selectedDiscountTarget.substring(4));
        const val = targetDiscountPercent.trim() ? Number(targetDiscountPercent) : null;
        
        const { error } = await supabase
          .from('categories')
          .update({ discount_percent: val })
          .eq('id', catId);

        if (error) throw new Error(error.message);

        // Update local categories state
        setCategories(prev => prev.map(c => c.id === catId ? { ...c, discount_percent: val } : c));
        alert('Descuento de categoría guardado correctamente.');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar el descuento.');
    } finally {
      setSavingDiscount(false);
    }
  }

  async function handleDeleteDiscount(target: 'general' | number) {
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
        setGeneralDiscountPercent('');
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
                : activeTab === 'config'
                ? 'Configuración'
                : activeTab === 'sales'
                ? 'Historial de Ventas'
                : activeTab === 'sales-create'
                ? 'Registrar Nueva Venta'
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


        {/* Catalog View */}
        {activeTab === 'catalog' && (() => {
          let displayedArticles = selectedCatalogCategoryId === null
            ? articles
            : articles.filter((a) => a.category_id === selectedCatalogCategoryId);

          if (searchQuery.trim()) {
            const query = searchQuery.trim().toLowerCase();
            displayedArticles = displayedArticles.filter((a) => {
              const idString = String(a.id);
              const formattedRefCode = `mec-${idString.padStart(4, '0')}`;
              const titleMatch = a.title.toLowerCase().includes(query);
              const descMatch = a.description?.toLowerCase().includes(query) || false;
              const idMatch = idString === query || formattedRefCode.includes(query) || idString.includes(query);
              return idMatch || titleMatch || descMatch;
            });
          }

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

              {/* Search Bar */}
              {!loadingArticles && (
                <div className={styles.searchBar}>
                  <div className={styles.searchInputWrapper}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={styles.searchIcon}
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Buscar por ID (ej. 42), marca o modelo..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={styles.searchInput}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className={styles.searchClear}
                        title="Limpiar búsqueda"
                      >
                        ✕
                      </button>
                    )}
                  </div>
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
                            <div className={styles.cardNoImage}>
                              El fotógrafo se está tomando unos días libres.<br />
                              🏖️☀️🍹
                            </div>
                          )}
                        </div>
                        <div className={styles.cardContent}>
                          <div className={styles.cardHeader}>
                            <div className={styles.cardInfoCol}>
                              <span className={styles.cardCategory}>
                                {catName} <span className={styles.cardIdBadge}>ID: {article.id}</span>
                              </span>
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
                            </div>
                            <div className={styles.cardStatsRow}>
                              <span className={styles.cardViews} title="Visualizaciones de la ficha">
                                👁️ {article.views ?? 0}
                              </span>
                              <span className={styles.cardClicks} title="Clics de contacto recibidos">
                                📞 {article.contact_clicks ?? 0}
                              </span>
                              <span className={styles.cardShareClicks} title="Clics de compartir recibidos">
                                🔗 {article.share_clicks ?? 0}
                              </span>
                            </div>
                          </div>
                          <div className={styles.cardMeta}>
                            <span className={styles.cardPrice}>
                              {formatPrice(article.price)}
                            </span>
                            <div className="flex gap-2 items-center">
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

        {/* Config View */}
        {activeTab === 'config' && (
          <div className={styles.paymentsSection} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* Sección 1: Pagos */}
            <div className={styles.paymentsCard}>
              <h2 className={styles.paymentsCardTitle}>Pagos</h2>
              <p className={styles.paymentsCardDesc}>
                Ajustes de Métodos de Pago Online
              </p>

              {loadingPaymentsSetting ? (
                <div className={styles.paymentsLoading}>Cargando estado de los ajustes...</div>
              ) : !hasSettingsTable ? (
                <div className={styles.paymentsWarning}>
                  <h3>⚠️ Configuración requerida en base de datos</h3>
                  <p>
                    La tabla <code>settings</code> no existe todavía en tu base de datos de Supabase.
                    Para activar esta funcionalidad, copia y ejecuta el siguiente código en el <strong>SQL Editor</strong> de tu panel de Supabase:
                  </p>
                  <pre className={styles.paymentsSqlBlock}>
{`CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(255) PRIMARY KEY,
  value VARCHAR(255) NOT NULL
);

INSERT INTO settings (key, value)
VALUES 
  ('payments_enabled', 'false'),
  ('revolut_enabled', 'true'),
  ('paypal_enabled', 'true'),
  ('hide_prices', 'false'),
  ('hide_availability', 'false')
ON CONFLICT (key) DO NOTHING;`}
                  </pre>
                  <button
                    type="button"
                    onClick={loadPaymentsSetting}
                    className={styles.paymentsRetryButton}
                  >
                    Recargar ajuste
                  </button>
                </div>
              ) : (
                <div className={styles.paymentsList}>
                  {/* Master Switch */}
                  <div className={`${styles.paymentsToggleRow} ${hidePrices ? styles.disabledRow : ''}`}>
                    <div className={styles.paymentsToggleText}>
                      <span className={styles.paymentsToggleLabel}>
                        General - Metodos de pago online
                      </span>
                      <span className={styles.paymentsToggleSublabel}>
                        {hidePrices
                          ? 'Inhabilitado — Los precios de los artículos están ocultos.'
                          : paymentsEnabled 
                          ? 'Activo — Se mostrarán los botones de compra seleccionados abajo.' 
                          : 'Inactivo — Se ocultan todos los botones de pago directo en toda la web.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={hidePrices}
                      onClick={() => togglePayments(!paymentsEnabled)}
                      className={`${styles.switch} ${paymentsEnabled && !hidePrices ? styles.switchActive : ''}`}
                      aria-label="Alternar todos los métodos de pago"
                      title="Alternar todos los métodos de pago"
                    >
                      <span className={styles.switchHandle} />
                    </button>
                  </div>

                  {/* Revolut Switch */}
                  <div className={`${styles.paymentsToggleRow} ${(!paymentsEnabled || hidePrices) ? styles.disabledRow : ''}`}>
                    <div className={styles.paymentsToggleText}>
                      <span className={styles.paymentsToggleLabel}>
                        Pago Online Revolut
                      </span>
                      <span className={styles.paymentsToggleSublabel}>
                        Muestra el botón de compra que redirige al enlace de Revolut.me.
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={!paymentsEnabled || hidePrices}
                      onClick={() => toggleRevolut(!revolutEnabled)}
                      className={`${styles.switch} ${revolutEnabled && paymentsEnabled && !hidePrices ? styles.switchActive : ''}`}
                      aria-label="Alternar Revolut"
                      title="Alternar Revolut"
                    >
                      <span className={styles.switchHandle} />
                    </button>
                  </div>

                  {/* PayPal Switch */}
                  <div className={`${styles.paymentsToggleRow} ${(!paymentsEnabled || hidePrices) ? styles.disabledRow : ''}`}>
                    <div className={styles.paymentsToggleText}>
                      <span className={styles.paymentsToggleLabel}>
                        Pago Online PayPal
                      </span>
                      <span className={styles.paymentsToggleSublabel}>
                        Muestra el botón de compra que redirige a la pasarela de PayPal con el importe y concepto del artículo.
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={!paymentsEnabled || hidePrices}
                      onClick={() => togglePaypal(!paypalEnabled)}
                      className={`${styles.switch} ${paypalEnabled && paymentsEnabled && !hidePrices ? styles.switchActive : ''}`}
                      aria-label="Alternar PayPal"
                      title="Alternar PayPal"
                    >
                      <span className={styles.switchHandle} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sección 2: Visibilidad */}
            <div className={styles.paymentsCard}>
              <h2 className={styles.paymentsCardTitle}>Visibilidad</h2>
              <p className={styles.paymentsCardDesc}>
                Opciones de visualización de precios y disponibilidad
              </p>

              {loadingPaymentsSetting ? (
                <div className={styles.paymentsLoading}>Cargando estado de los ajustes...</div>
              ) : (
                <div className={styles.paymentsList}>
                  {/* Hide Prices Switch */}
                  <div className={styles.paymentsToggleRow}>
                    <div className={styles.paymentsToggleText}>
                      <span className={styles.paymentsToggleLabel}>
                        Mostrar precios de artículos
                      </span>
                      <span className={styles.paymentsToggleSublabel}>
                        {!hidePrices
                          ? 'Activo — Los precios se mostrarán en la ficha y en el listado de artículos.'
                          : 'Inactivo — Los precios no se mostrarán en la ficha ni en el listado de artículos.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleHidePrices(!hidePrices)}
                      className={`${styles.switch} ${!hidePrices ? styles.switchActive : ''}`}
                      aria-label="Alternar mostrar precios de artículos"
                      title="Alternar mostrar precios de artículos"
                    >
                      <span className={styles.switchHandle} />
                    </button>
                  </div>

                  {/* Hide Availability Switch */}
                  <div className={styles.paymentsToggleRow}>
                    <div className={styles.paymentsToggleText}>
                      <span className={styles.paymentsToggleLabel}>
                        Mostrar información de disponibilidad
                      </span>
                      <span className={styles.paymentsToggleSublabel}>
                        {!hideAvailability
                          ? 'Activo — La disponibilidad de stock se mostrará en la ficha del artículo.'
                          : 'Inactivo — La disponibilidad de stock no se mostrará en la ficha del artículo.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleHideAvailability(!hideAvailability)}
                      className={`${styles.switch} ${!hideAvailability ? styles.switchActive : ''}`}
                      aria-label="Alternar mostrar información de disponibilidad"
                      title="Alternar mostrar información de disponibilidad"
                    >
                      <span className={styles.switchHandle} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sección 3: Descuentos Masivos */}
            <div className={styles.paymentsCard}>
              <h2 className={styles.paymentsCardTitle}>Configuración de descuentos:</h2>
              <p className={styles.paymentsCardDesc}>
                Aplica descuentos de porcentaje (%) a toda la web o por categorías de origen.
              </p>

              {!hasDiscountColumns ? (
                <div className={styles.paymentsWarning}>
                  <h3>⚠️ Configuración requerida en base de datos</h3>
                  <p>
                    Para usar esta sección de descuentos, es necesario añadir las columnas de descuento en tu base de datos de Supabase.
                    Copia y ejecuta el siguiente código en el <strong>SQL Editor</strong> de tu panel de Supabase y recarga:
                  </p>
                  <pre className={styles.paymentsSqlBlock}>
{`ALTER TABLE articles ADD COLUMN IF NOT EXISTS discount_type TEXT CHECK (discount_type IN ('percentage', 'amount'));
ALTER TABLE articles ADD COLUMN IF NOT EXISTS discount_value NUMERIC;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS discount_percent INTEGER CHECK (discount_percent >= 1 AND discount_percent <= 100);`}
                  </pre>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className={styles.paymentsRetryButton}
                  >
                    Recargar página
                  </button>
                </div>
              ) : (
                <>
                  <form onSubmit={handleSaveDiscount} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '12px' }}>
                    <label className={styles.field}>
                      <span className={styles.labelRow}>
                        <span>Seleccionar objetivo del descuento</span>
                        <span className={styles.hint}>Requerido</span>
                      </span>
                      <select
                        value={selectedDiscountTarget}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedDiscountTarget(val);
                          if (val === 'general') {
                            setTargetDiscountPercent(generalDiscountPercent);
                          } else if (val.startsWith('cat-')) {
                            const catId = Number(val.substring(4));
                            const cat = categories.find(c => c.id === catId);
                            setTargetDiscountPercent(cat?.discount_percent ? String(cat.discount_percent) : '');
                          } else {
                            setTargetDiscountPercent('');
                          }
                        }}
                        className={styles.control}
                        required
                      >
                        <option value="">Selecciona una opción...</option>
                        <option value="general">General (Toda la Web)</option>
                        <option value="separator" disabled>────────────────────</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={`cat-${cat.id}`}>
                            {getFlagEmoji(cat.country_code)} {cat.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    {selectedDiscountTarget && selectedDiscountTarget !== 'separator' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Priority Warning alert if applicable */}
                        {(() => {
                          if (selectedDiscountTarget === 'general') {
                            const hasArticleDiscounts = articles.some(a => a.discount_type);
                            const hasCategoryDiscounts = categories.some(c => c.discount_percent);
                            if (hasArticleDiscounts || hasCategoryDiscounts) {
                              return (
                                <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.3)', color: 'var(--text-primary)', fontSize: '13px', lineHeight: '1.45' }}>
                                  ⚠️ Nota: Hay artículos o categorías con descuentos específicos (prioridad superior) que no se verán afectados por este descuento general a menos que su descuento específico sea menor.
                                </div>
                              );
                            }
                          } else if (selectedDiscountTarget.startsWith('cat-')) {
                            const catId = Number(selectedDiscountTarget.substring(4));
                            const hasArticleDiscounts = articles.some(a => a.category_id === catId && a.discount_type);
                            if (hasArticleDiscounts) {
                              return (
                                <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.3)', color: 'var(--text-primary)', fontSize: '13px', lineHeight: '1.45' }}>
                                  ⚠️ Nota: Hay artículos en esta categoría con descuento individual (prioridad superior) que no se verán afectados por este descuento de categoría a menos que su descuento específico sea menor.
                                </div>
                              );
                            }
                          }
                          return null;
                        })()}

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                          <div>
                            <span style={{ fontWeight: '700', fontSize: '14px', display: 'block' }}>Activar descuento</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              Habilita el descuento para {selectedDiscountTarget === 'general' ? 'toda la web' : 'esta categoría'}.
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setTargetDiscountPercent(prev => prev ? '' : '10');
                            }}
                            className={`${styles.switch} ${targetDiscountPercent ? styles.switchActive : ''}`}
                            title="Alternar descuento"
                            style={{ flexShrink: 0, marginLeft: '12px' }}
                          >
                            <span className={styles.switchHandle} />
                          </button>
                        </div>

                        {targetDiscountPercent !== '' && (
                          <label className={styles.field} style={{ borderLeft: '3px solid var(--border-card)', paddingLeft: '16px' }}>
                            <span className={styles.labelRow}>
                              <span>Porcentaje de descuento (%)</span>
                              <span className={styles.hint}>Valor entero de 1 a 100</span>
                            </span>
                            <input
                              type="number"
                              value={targetDiscountPercent}
                              onChange={(e) => setTargetDiscountPercent(e.target.value)}
                              min="1"
                              max="100"
                              step="1"
                              required
                              placeholder="Ej: 10"
                              className={styles.control}
                              disabled={savingDiscount}
                            />
                          </label>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDiscountTarget('');
                              setTargetDiscountPercent('');
                            }}
                            className={styles.secondaryButton}
                            disabled={savingDiscount}
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            className={styles.primaryButton}
                            disabled={savingDiscount}
                          >
                            {savingDiscount ? 'Guardando...' : 'Guardar Descuento'}
                          </button>
                        </div>
                      </div>
                    )}
                  </form>

                  {/* Active Discounts List merged directly here */}
                  <div style={{ marginTop: '32px', borderTop: '1px solid var(--border-card)', paddingTop: '24px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '14px', color: 'var(--text-primary)' }}>
                      Descuentos Masivos Activos
                    </h3>
                    {(() => {
                      const activeGeneral = generalDiscountPercent && Number(generalDiscountPercent) > 0;
                      const activeCategories = categories.filter(c => c.discount_percent && c.discount_percent > 0);
                      
                      if (!activeGeneral && activeCategories.length === 0) {
                        return (
                          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                            No hay descuentos generales ni de categoría activos actualmente.
                          </p>
                        );
                      }
                      
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {activeGeneral && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 16px',
                              borderRadius: '10px',
                              background: 'var(--bg-card-glass)',
                              border: '1px solid var(--border-card-glass)'
                            }}>
                              <div>
                                <span style={{ fontWeight: '850', fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>
                                  🌍 Descuento General (Toda la Web)
                                </span>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                  Porcentaje: <strong>{generalDiscountPercent}%</strong>
                                </span>
                              </div>
                              <button
                                type="button"
                                disabled={savingDiscount}
                                onClick={() => handleDeleteDiscount('general')}
                                className={`${styles.dangerButtonSmall} ${styles.solidRedButton}`}
                                style={{ padding: '8px 14px', height: 'auto', borderRadius: '6px', fontSize: '12px', fontWeight: '800' }}
                              >
                                Eliminar
                              </button>
                            </div>
                          )}
                          
                          {activeCategories.map(cat => (
                            <div key={cat.id} style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 16px',
                              borderRadius: '10px',
                              background: 'var(--bg-card-glass)',
                              border: '1px solid var(--border-card-glass)'
                            }}>
                              <div>
                                <span style={{ fontWeight: '850', fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>
                                  {getFlagEmoji(cat.country_code)} Categoría: {cat.name}
                                </span>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                  Porcentaje: <strong>{cat.discount_percent}%</strong>
                                </span>
                              </div>
                              <button
                                type="button"
                                disabled={savingDiscount}
                                onClick={() => handleDeleteDiscount(cat.id)}
                                className={`${styles.dangerButtonSmall} ${styles.solidRedButton}`}
                                style={{ padding: '8px 14px', height: 'auto', borderRadius: '6px', fontSize: '12px', fontWeight: '800' }}
                              >
                                Eliminar
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* --- VISTAS DE GESTIÓN DE VENTAS --- */}
        {activeTab === 'sales' && (() => {
          let filteredSales = sales;
          
          if (salesSubmenu === 'prepurchase') {
            filteredSales = filteredSales.filter(s => s.status === 'PRECOMPRA');
          } else if (salesSubmenu === 'completed') {
            filteredSales = filteredSales.filter(s => s.status === 'COMPLETADA');
          }

          if (salesSearch.trim()) {
            const query = salesSearch.toLowerCase().trim();
            filteredSales = filteredSales.filter(s => 
              s.id.toLowerCase().includes(query) ||
              (s.buyer_email && s.buyer_email.toLowerCase().includes(query)) ||
              (s.buyer_phone && s.buyer_phone.toLowerCase().includes(query)) ||
              (s.location && s.location.toLowerCase().includes(query))
            );
          }

          if (salesFilterPayment !== 'all') {
            filteredSales = filteredSales.filter(s => s.payment_type === salesFilterPayment);
          }

          if (salesFilterStatus !== 'all') {
            filteredSales = filteredSales.filter(s => s.status === salesFilterStatus);
          }

          if (salesFilterDate !== 'all') {
            const now = new Date();
            filteredSales = filteredSales.filter(s => {
              const date = new Date(s.created_at);
              if (salesFilterDate === 'today') {
                return date.toDateString() === now.toDateString();
              } else if (salesFilterDate === 'week') {
                const diffTime = Math.abs(now.getTime() - date.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays <= 7;
              } else if (salesFilterDate === 'month') {
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
              }
              return true;
            });
          }

          return (
            <div className={styles.salesTabContainer}>
              <div className={styles.salesSubmenuBar}>
                <button
                  type="button"
                  onClick={() => setSalesSubmenu('all')}
                  className={`${styles.salesSubmenuButton} ${salesSubmenu === 'all' ? styles.salesSubmenuActive : ''}`}
                >
                  Todas las Ventas
                </button>
                <button
                  type="button"
                  onClick={() => setSalesSubmenu('prepurchase')}
                  className={`${styles.salesSubmenuButton} ${salesSubmenu === 'prepurchase' ? styles.salesSubmenuActive : ''}`}
                >
                  Precompras Activas ⚠️
                </button>
                <button
                  type="button"
                  onClick={() => setSalesSubmenu('completed')}
                  className={`${styles.salesSubmenuButton} ${salesSubmenu === 'completed' ? styles.salesSubmenuActive : ''}`}
                >
                  Ventas Completadas ✓
                </button>
              </div>

              <div className={styles.salesFiltersBar}>
                <input
                  type="text"
                  placeholder="Buscar por Email, Teléfono, Lugar o ID..."
                  value={salesSearch}
                  onChange={(e) => setSalesSearch(e.target.value)}
                  className={styles.salesSearchInput}
                />
                
                <select
                  value={salesFilterPayment}
                  onChange={(e: any) => setSalesFilterPayment(e.target.value)}
                  className={styles.salesSelectFilter}
                >
                  <option value="all">Todos los Pagos</option>
                  <option value="REVOLUT">Revolut</option>
                  <option value="PAYPAL">PayPal</option>
                  <option value="EFECTIVO">Efectivo</option>
                </select>

                <select
                  value={salesFilterStatus}
                  onChange={(e: any) => setSalesFilterStatus(e.target.value)}
                  className={styles.salesSelectFilter}
                >
                  <option value="all">Todos los Estados</option>
                  <option value="COMPLETADA">Completada</option>
                  <option value="PRECOMPRA">Precompra</option>
                </select>

                <select
                  value={salesFilterDate}
                  onChange={(e: any) => setSalesFilterDate(e.target.value)}
                  className={styles.salesSelectFilter}
                >
                  <option value="all">Cualquier Fecha</option>
                  <option value="today">Hoy</option>
                  <option value="week">Últimos 7 días</option>
                  <option value="month">Este mes</option>
                </select>
              </div>

              {loadingSales ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Cargando ventas...</div>
              ) : filteredSales.length === 0 ? (
                <div className={styles.salesEmptyState}>
                  <p>No se encontraron registros de ventas con los filtros actuales.</p>
                </div>
              ) : (
                <div className={styles.salesTableWrapper}>
                  <table className={styles.salesTable}>
                    <thead>
                      <tr>
                        <th>ID Venta</th>
                        <th>Fecha</th>
                        <th>Comprador</th>
                        <th>Ubicación</th>
                        <th>Pago</th>
                        <th style={{ textAlign: 'center' }}>Artículos</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                        <th style={{ textAlign: 'center' }}>Estado</th>
                        <th style={{ textAlign: 'center' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSales.map((sale) => (
                        <tr key={sale.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {sale.id.substring(0, 8).toUpperCase()}
                          </td>
                          <td>
                            {new Date(sale.created_at).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td>
                            {sale.buyer_email || sale.buyer_phone ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {sale.buyer_email && <span style={{ fontSize: '13px' }}>{sale.buyer_email}</span>}
                                {sale.buyer_phone && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{sale.buyer_phone}</span>}
                              </div>
                            ) : (
                              <span style={{ fontStyle: 'italic', color: 'var(--text-tertiary)' }}>Directa</span>
                            )}
                          </td>
                          <td>{sale.location}</td>
                          <td>
                            <span className={styles.paymentBadge}>{sale.payment_type}</span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                            {sale.total_articles}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace' }}>
                            {formatPrice(sale.total_price)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`${styles.statusBadge} ${sale.status === 'PRECOMPRA' ? styles.statusBadgePrepurchase : styles.statusBadgeCompleted}`}>
                              {sale.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => viewSaleDetail(sale)}
                              className={styles.viewDetailBtn}
                            >
                              Ver Detalle
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

        {activeTab === 'sales-create' && (() => {
          let selectArticles = articles;
          if (salesCreateSearch.trim()) {
            const query = salesCreateSearch.toLowerCase().trim();
            selectArticles = selectArticles.filter(a => 
              a.title.toLowerCase().includes(query) ||
              String(a.id).includes(query)
            );
          }

          let summaryTotal = 0;
          let summaryCount = 0;
          selectedArticleIds.forEach(id => {
            const art = articles.find(a => a.id === id);
            if (!art) return;
            const qty = saleItemQuantities.get(id) || 1;
            const price = saleItemPrices.has(id)
              ? (saleItemPrices.get(id) ?? 0)
              : getFinalPriceForArticle(art);
            summaryTotal += price * qty;
            summaryCount += qty;
          });

          return (
            <div className={styles.salesCreateContainer}>
              <div className={styles.salesCreateGrid}>
                <div className={styles.salesCreateCard}>
                  <h2 className={styles.salesCardTitle}>1. Seleccionar Artículos</h2>
                  
                  <input
                    type="text"
                    placeholder="Buscar por marca, modelo o ID..."
                    value={salesCreateSearch}
                    onChange={(e) => setSalesCreateSearch(e.target.value)}
                    className={styles.salesSearchInput}
                    style={{ marginBottom: '16px' }}
                  />

                  <div className={styles.salesArticleSelectList}>
                    {selectArticles.length === 0 ? (
                      <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px' }}>No hay artículos que coincidan.</p>
                    ) : (
                      selectArticles.map(art => {
                        const finalPrice = getFinalPriceForArticle(art);
                        const isChecked = selectedArticleIds.includes(art.id);
                        
                        return (
                          <div 
                            key={art.id} 
                            className={`${styles.salesArticleSelectRow} ${isChecked ? styles.rowChecked : ''}`}
                            onClick={() => {
                              if (isChecked) {
                                setSelectedArticleIds(prev => prev.filter(id => id !== art.id));
                              } else {
                                setSelectedArticleIds(prev => [...prev, art.id]);
                                setSaleItemQuantities(prev => {
                                  const n = new Map(prev);
                                  n.set(art.id, 1);
                                  return n;
                                });
                              }
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              readOnly
                              className={styles.salesCheckbox}
                            />
                            
                            {art.image_urls && art.image_urls[0] && (
                              <img 
                                src={art.image_urls[0]} 
                                alt={art.title} 
                                className={styles.selectRowThumb} 
                              />
                            )}

                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{art.title}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', gap: '10px', marginTop: '2px' }}>
                                <span>Ref ID: MEC-{String(art.id).padStart(4, '0')}</span>
                                <span style={{ fontWeight: 'bold', color: art.quantity <= 0 ? 'var(--text-soldout)' : 'var(--text-available)' }}>
                                  Stock: {art.quantity <= 0 ? `0 (Agotado)` : art.quantity}
                                </span>
                              </div>
                            </div>
                            
                            <div style={{ fontWeight: 'bold', fontSize: '14px', fontFamily: 'monospace' }}>
                              {formatPrice(finalPrice)}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className={styles.salesCreateCard}>
                  <h2 className={styles.salesCardTitle}>2. Detalles de Venta</h2>
                  
                  {selectedArticleIds.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)', border: '1px dashed var(--border-card-glass)', borderRadius: '8px' }}>
                      Selecciona artículos en el panel izquierdo para agregarlos a la venta.
                    </div>
                  ) : (
                    <>
                      <div className={styles.selectedItemsConfigList}>
                        {selectedArticleIds.map(id => {
                          const art = articles.find(a => a.id === id);
                          if (!art) return null;

                          const qty = saleItemQuantities.get(id) || 1;
                          const officialPrice = getFinalPriceForArticle(art);
                          const customPrice = saleItemPrices.has(id) ? (saleItemPrices.get(id) ?? 0) : officialPrice;
                          const isCustomPrice = saleItemPrices.has(id) && saleItemPrices.get(id) !== officialPrice;
                          const isPrepurchase = qty > art.quantity;

                          return (
                            <div key={id} className={styles.configItemRow}>
                              <div className={styles.configItemInfo}>
                                <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{art.title}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                  Ref ID: MEC-{String(art.id).padStart(4, '0')} | Precio oficial: {formatPrice(officialPrice)}
                                </div>
                                {isPrepurchase && (
                                  <span className={styles.prepurchaseBadge}>
                                    PRECOMPRA* (Falta stock. Disponible: {art.quantity})
                                  </span>
                                )}
                              </div>

                              <div className={styles.configItemInputs}>
                                <div className={styles.inputFieldCompact}>
                                  <label>Cant.</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={qty}
                                    onChange={(e) => {
                                      const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                      setSaleItemQuantities(prev => {
                                        const n = new Map(prev);
                                        n.set(id, val);
                                        return n;
                                      });
                                    }}
                                    className={styles.compactNumberInput}
                                  />
                                </div>

                                <div className={styles.inputFieldCompact}>
                                  <label>Precio €</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={customPrice}
                                    placeholder={String(officialPrice)}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                                      setSaleItemPrices(prev => {
                                        const n = new Map(prev);
                                        n.set(id, val);
                                        return n;
                                      });
                                    }}
                                    className={`${styles.compactNumberInput} ${isCustomPrice ? styles.customPriceActive : ''}`}
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setSelectedArticleIds(prev => prev.filter(aid => aid !== id))}
                                  className={styles.removeItemBtn}
                                  title="Quitar artículo"
                                >
                                  ✕
                                </button>
                              </div>
                              {isCustomPrice && (
                                <div className={styles.priceWarningBanner}>
                                  Aviso: El precio fijado ({formatPrice(customPrice)}) es {customPrice > officialPrice ? 'superior' : 'inferior'} al registrado ({formatPrice(officialPrice)})
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '24px', borderTop: '1px solid var(--border-card-glass)', paddingTop: '20px' }}>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                            <label className={styles.formLabel}>Teléfono Comprador (Opcional)</label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <select
                                value={saleBuyerPhoneCode}
                                onChange={(e) => setSaleBuyerPhoneCode(e.target.value)}
                                className={styles.salesPrefixSelect}
                              >
                                <option value="+34">🇪🇸 +34</option>
                                <option value="+33">🇫🇷 +33</option>
                                <option value="+49">🇩🇪 +49</option>
                                <option value="+39">🇮🇹 +39</option>
                                <option value="+44">🇬🇧 +44</option>
                                <option value="+351">🇵🇹 +351</option>
                                <option value="+1">🇺🇸 +1</option>
                              </select>
                              <input
                                type="text"
                                placeholder="600000000"
                                value={saleBuyerPhone}
                                onChange={(e) => setSaleBuyerPhone(e.target.value)}
                                className={styles.salesTextInput}
                                style={{ flex: 1 }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                            <label className={styles.formLabel}>Email Comprador (Opcional)</label>
                            <input
                              type="email"
                              placeholder="cliente@email.com"
                              value={saleBuyerEmail}
                              onChange={(e) => setSaleBuyerEmail(e.target.value)}
                              className={styles.salesTextInput}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                            <label className={styles.formLabel}>Localidad de venta</label>
                            <input
                              type="text"
                              value={saleLocation}
                              placeholder="online"
                              onChange={(e) => setSaleLocation(e.target.value)}
                              className={styles.salesTextInput}
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                            <label className={styles.formLabel}>Tipo de Pago</label>
                            <select
                              value={salePaymentType}
                              onChange={(e: any) => setSalePaymentType(e.target.value)}
                              className={styles.salesTextInput}
                            >
                              <option value="REVOLUT">Revolut</option>
                              <option value="PAYPAL">PayPal</option>
                              <option value="EFECTIVO">Efectivo</option>
                            </select>
                          </div>
                        </div>

                        <div className={styles.createSaleTotalPanel}>
                          <div className={styles.summaryRow}>
                            <span>Total Artículos:</span>
                            <strong>{summaryCount} uds.</strong>
                          </div>
                          <div className={styles.summaryRow} style={{ fontSize: '16px', borderTop: '1px solid var(--border-card-glass)', paddingTop: '10px', marginTop: '6px' }}>
                            <span>Total Final:</span>
                            <strong style={{ fontFamily: 'monospace' }}>{formatPrice(summaryTotal)}</strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowSaleSummary(true)}
                          className={styles.reviewSaleBtn}
                        >
                          Revisar Venta
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {showSaleSummary && (() => {
          let summaryTotal = 0;
          let summaryCount = 0;
          let hasPrepurchase = false;
          const chosenItems: any[] = [];

          selectedArticleIds.forEach(id => {
            const art = articles.find(a => a.id === id);
            if (!art) return;
            const qty = saleItemQuantities.get(id) || 1;
            const price = saleItemPrices.has(id)
              ? (saleItemPrices.get(id) ?? 0)
              : getFinalPriceForArticle(art);
            
            const isPrepurchase = qty > art.quantity;
            if (isPrepurchase) hasPrepurchase = true;

            summaryTotal += price * qty;
            summaryCount += qty;

            chosenItems.push({
              art,
              qty,
              price,
              isPrepurchase
            });
          });

          return (
            <div className={styles.modalOverlay}>
              <div className={styles.salesConfirmModal}>
                <h3 className={styles.modalTitle}>Confirmar Registro de Venta</h3>
                
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Por favor, revisa detalladamente el desglose antes de registrar la venta en el sistema.
                </p>

                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-card-glass)', borderRadius: '8px', marginBottom: '16px' }}>
                  {chosenItems.map(({ art, qty, price, isPrepurchase }) => (
                    <div key={art.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--border-card-glass)', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{art.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ID Ref: MEC-{String(art.id).padStart(4, '0')}</div>
                      </div>
                      
                      <div style={{ textWrap: 'nowrap', display: 'flex', gap: '14px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px' }}>
                          ud: <strong>{qty}</strong>{' '}
                          {isPrepurchase ? (
                            <span style={{ color: 'var(--text-soldout)', fontSize: '11px', fontWeight: 'bold' }}>(Precompra*)</span>
                          ) : (
                            <span style={{ color: 'var(--text-available)', fontSize: '11px' }}>(Stock OK)</span>
                          )}
                        </span>
                        
                        <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '13px' }}>
                          {formatPrice(price * qty)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.confirmSummaryInfo}>
                  <div className={styles.summaryRow}>
                    <span>Nº Artículos:</span>
                    <strong>{summaryCount} uds.</strong>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Lugar de venta:</span>
                    <strong>{saleLocation || 'online'}</strong>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Tipo de pago:</span>
                    <strong>{salePaymentType}</strong>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Comprador:</span>
                    <strong>
                      {saleBuyerEmail || saleBuyerPhone
                        ? `${saleBuyerEmail} ${saleBuyerPhone ? `(${saleBuyerPhoneCode}${saleBuyerPhone})` : ''}`
                        : 'Venta Directa'}
                    </strong>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Estado venta:</span>
                    <strong style={{ color: hasPrepurchase ? 'var(--text-soldout)' : 'var(--text-available)' }}>
                      {hasPrepurchase ? 'PRECOMPRA' : 'COMPLETADA'}
                    </strong>
                  </div>
                  
                  <div className={styles.summaryRow} style={{ fontSize: '16px', borderTop: '2px solid var(--text-primary)', paddingTop: '10px', marginTop: '8px' }}>
                    <span>Total Venta:</span>
                    <strong style={{ fontFamily: 'monospace' }}>{formatPrice(summaryTotal)}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button
                    type="button"
                    onClick={handleRegisterSale}
                    disabled={registeringSale}
                    className={`${styles.primaryButton} ${styles.solidGreenButton}`}
                    style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    {registeringSale ? 'Procesando...' : 'Registrar Venta'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSaleSummary(false)}
                    className={`${styles.dangerButton} ${styles.solidRedButton}`}
                    style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {selectedSaleDetail && (() => {
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          const invoiceUrl = `${origin}/invoice/${selectedSaleDetail.id}`;
          const sharingText = `Recibo de Venta - MiniEngines Creations (ID: ${selectedSaleDetail.id.substring(0, 8)})`;
          
          const encodedText = encodeURIComponent(sharingText);
          const encodedUrl = encodeURIComponent(invoiceUrl);
          
          const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`;
          const telegramUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
          const emailUrl = `mailto:?subject=${encodeURIComponent(sharingText)}&body=Enlace%20a%20tu%20recibo%20de%20compra:%20${encodedUrl}`;

          return (
            <div className={styles.modalOverlay}>
              <div className={styles.salesConfirmModal} style={{ maxWidth: '640px' }}>
                <h3 className={styles.modalTitle}>Detalle de Venta</h3>
                
                <div className={styles.confirmSummaryInfo} style={{ background: 'none', padding: 0, gap: '6px' }}>
                  <div className={styles.summaryRow}>
                    <span>Factura ID:</span>
                    <strong style={{ fontFamily: 'monospace' }}>MEC-{selectedSaleDetail.id.toUpperCase()}</strong>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Fecha:</span>
                    <strong>{new Date(selectedSaleDetail.created_at).toLocaleString('es-ES')}</strong>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Pago:</span>
                    <strong>{selectedSaleDetail.payment_type}</strong>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Lugar:</span>
                    <strong>{selectedSaleDetail.location}</strong>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Cliente:</span>
                    <strong>
                      {selectedSaleDetail.buyer_email || selectedSaleDetail.buyer_phone
                        ? `${selectedSaleDetail.buyer_email || ''} ${selectedSaleDetail.buyer_phone || ''}`
                        : 'Venta Directa'}
                    </strong>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Estado:</span>
                    <strong style={{ color: selectedSaleDetail.status === 'PRECOMPRA' ? 'var(--text-soldout)' : 'var(--text-available)' }}>
                      {selectedSaleDetail.status}
                    </strong>
                  </div>
                </div>

                <h4 style={{ fontSize: '13px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid var(--border-card-glass)', paddingBottom: '4px' }}>Artículos Vendidos</h4>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-card-glass)', borderRadius: '8px', marginBottom: '16px' }}>
                  {loadingSaleItems ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando artículos...</div>
                  ) : saleDetailItems.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No hay artículos vinculados a esta venta.</div>
                  ) : (
                    saleDetailItems.map((item) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--border-card-glass)', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{item.title}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ID Ref: MEC-{String(item.article_id).padStart(4, '0')}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px' }}>
                            Cant: <strong>{item.quantity}</strong>{' '}
                            {item.is_prepurchase ? (
                              <span style={{ color: 'var(--text-soldout)', fontSize: '11px', fontWeight: 'bold' }}>(Precompra)</span>
                            ) : (
                              <span style={{ color: 'var(--text-available)', fontSize: '11px' }}>(Completado)</span>
                            )}
                          </span>
                          <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '13px' }}>
                            {formatPrice(item.price * item.quantity)}
                          </span>

                          {item.is_prepurchase && (
                            <button
                              type="button"
                              onClick={() => completePrepurchaseItem(item)}
                              className={styles.completeItemBtn}
                              title="Marcar como listo y subir stock en 1"
                            >
                              ✓ Completar
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className={styles.summaryRow} style={{ fontSize: '16px', fontWeight: 'bold', borderTop: '1px solid var(--border-card-glass)', paddingTop: '10px' }}>
                  <span>Total Facturado:</span>
                  <span style={{ fontFamily: 'monospace' }}>{formatPrice(selectedSaleDetail.total_price)}</span>
                </div>

                <div style={{ borderTop: '1px solid var(--border-card-glass)', marginTop: '20px', paddingTop: '16px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Compartir Factura:</span>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={`${styles.shareLink} ${styles.waShare}`} style={{ flex: 1, textDecoration: 'none', padding: '10px', borderRadius: '8px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                      WhatsApp
                    </a>
                    <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className={`${styles.shareLink} ${styles.tgShare}`} style={{ flex: 1, textDecoration: 'none', padding: '10px', borderRadius: '8px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                      Telegram
                    </a>
                    <a href={emailUrl} className={`${styles.shareLink} ${styles.emailShare}`} style={{ flex: 1, textDecoration: 'none', padding: '10px', borderRadius: '8px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                      Email
                    </a>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '20px', borderTop: '1px solid var(--border-card-glass)', paddingTop: '16px' }}>
                  <a
                    href={invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.primaryButton} ${styles.solidBlueButton}`}
                    style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', textDecoration: 'none', textAlign: 'center', fontSize: '13px' }}
                  >
                    Ver Online / PDF 📄
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSaleDetail(null);
                      setSaleDetailItems([]);
                    }}
                    className={`${styles.secondaryButton} ${styles.solidGrayButton}`}
                    style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {(() => {
          if (!showDiscountWarnModal || !pendingSubmitData) return null;
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
      </section>
    </main>
  );
}
