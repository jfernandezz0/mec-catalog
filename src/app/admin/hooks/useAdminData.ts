import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Category, Article } from '@/lib/types';
import type { User } from '@supabase/supabase-js';
import { safeFetchCategories, safeFetchArticles } from '@/lib/supabase-helpers';

export interface UseAdminDataReturn {
  // Core data
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  articles: Article[];
  setArticles: React.Dispatch<React.SetStateAction<Article[]>>;
  user: User | null;

  // Loading states
  checkingAuth: boolean;
  loadingCategories: boolean;
  loadingArticles: boolean;
  loadingPaymentsSetting: boolean;

  // Feature detection
  hasVisibilityColumn: boolean;
  setHasVisibilityColumn: React.Dispatch<React.SetStateAction<boolean>>;
  hasDiscountColumns: boolean;
  setHasDiscountColumns: React.Dispatch<React.SetStateAction<boolean>>;
  hasSettingsTable: boolean;

  // Settings
  paymentsEnabled: boolean;
  setPaymentsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  revolutEnabled: boolean;
  setRevolutEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  paypalEnabled: boolean;
  setPaypalEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  hidePrices: boolean;
  setHidePrices: React.Dispatch<React.SetStateAction<boolean>>;
  hideAvailability: boolean;
  setHideAvailability: React.Dispatch<React.SetStateAction<boolean>>;
  generalDiscountPercent: string;
  setGeneralDiscountPercent: React.Dispatch<React.SetStateAction<string>>;

  // Functions
  loadCategories: () => Promise<void>;
  loadArticles: () => Promise<void>;
  loadPaymentsSetting: () => Promise<void>;
  reloadCategories: () => Promise<void>;
  updateSetting: (key: string, value: string) => Promise<void>;
}

export function useAdminData(onUserReady?: () => void): UseAdminDataReturn {
  // Core data states
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [user, setUser] = useState<User | null>(null);

  // Loading states
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [loadingPaymentsSetting, setLoadingPaymentsSetting] = useState(true);

  // Feature detection
  const [hasVisibilityColumn, setHasVisibilityColumn] = useState(true);
  const [hasDiscountColumns, setHasDiscountColumns] = useState(true);
  const [hasSettingsTable, setHasSettingsTable] = useState(true);

  // Settings
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [revolutEnabled, setRevolutEnabled] = useState(true);
  const [paypalEnabled, setPaypalEnabled] = useState(true);
  const [hidePrices, setHidePrices] = useState(false);
  const [hideAvailability, setHideAvailability] = useState(false);
  const [generalDiscountPercent, setGeneralDiscountPercent] = useState('');

  // --- Auth effect ---
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

  // --- Data loading functions ---

  const loadCategories = useCallback(async function loadCategories() {
    setLoadingCategories(true);
    try {
      const { categories, hasVisibilityColumn, hasDiscountColumns } = await safeFetchCategories();
      setCategories(categories);
      setHasVisibilityColumn(hasVisibilityColumn);
      setHasDiscountColumns(hasDiscountColumns);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const loadArticles = useCallback(async function loadArticles() {
    setLoadingArticles(true);
    try {
      const { articles, hasDiscountColumns } = await safeFetchArticles();
      setArticles(articles);
      setHasDiscountColumns(hasDiscountColumns);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingArticles(false);
    }
  }, []);

  const loadPaymentsSetting = useCallback(async function loadPaymentsSetting() {
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
  }, []);

  const updateSetting = useCallback(async function updateSetting(key: string, value: string) {
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
  }, [hasSettingsTable]);

  const reloadCategories = useCallback(async function reloadCategories() {
    try {
      const { categories, hasVisibilityColumn, hasDiscountColumns } = await safeFetchCategories();
      setCategories(categories);
      setHasVisibilityColumn(hasVisibilityColumn);
      setHasDiscountColumns(hasDiscountColumns);
    } catch (err: any) {
      throw new Error(err.message);
    }
  }, []);

  // --- Initial data loading effect ---
  useEffect(() => {
    if (!user) return;
    loadCategories();
    loadArticles();
    loadPaymentsSetting();
    if (onUserReady) onUserReady();
  }, [user, loadCategories, loadArticles, loadPaymentsSetting, onUserReady]);

  return {
    // Core data
    categories,
    setCategories,
    articles,
    setArticles,
    user,

    // Loading states
    checkingAuth,
    loadingCategories,
    loadingArticles,
    loadingPaymentsSetting,

    // Feature detection
    hasVisibilityColumn,
    setHasVisibilityColumn,
    hasDiscountColumns,
    setHasDiscountColumns,
    hasSettingsTable,

    // Settings
    paymentsEnabled,
    setPaymentsEnabled,
    revolutEnabled,
    setRevolutEnabled,
    paypalEnabled,
    setPaypalEnabled,
    hidePrices,
    setHidePrices,
    hideAvailability,
    setHideAvailability,
    generalDiscountPercent,
    setGeneralDiscountPercent,

    // Functions
    loadCategories,
    loadArticles,
    loadPaymentsSetting,
    reloadCategories,
    updateSetting,
  };
}
