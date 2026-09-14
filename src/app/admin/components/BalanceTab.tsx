'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';
import { Sale, Expense, ExpenseCategory } from '@/lib/types';
import styles from '../admin.module.css';

interface BalanceTabProps {
  sales: Sale[];
  onNavigateToRegisterExpense: () => void;
}

type PeriodFilter = 'this_month' | 'last_30_days' | 'this_quarter' | 'this_year' | 'all';

const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  MATERIALES: { label: 'Materiales / Stock', icon: '🧵', color: '#6366f1' },
  ENVIOS: { label: 'Envíos / Paquetería', icon: '📦', color: '#3b82f6' },
  PACKAGING: { label: 'Packaging / Embalaje', icon: '🏷️', color: '#ec4899' },
  HERRAMIENTAS: { label: 'Herramientas / Maquinaria', icon: '🛠️', color: '#f59e0b' },
  MARKETING: { label: 'Publicidad / Marketing', icon: '📢', color: '#8b5cf6' },
  EVENTOS: { label: 'Ferias / Eventos Presenciales', icon: '🎪', color: '#10b981' },
  SERVICIOS: { label: 'Software / Hosting / Dominio', icon: '💻', color: '#06b6d4' },
  IMPUESTOS: { label: 'Impuestos / Gestoría', icon: '🧾', color: '#ef4444' },
  OTROS: { label: 'Otros Gastos', icon: '📌', color: '#6b7280' },
};

export default function BalanceTab({
  sales,
  onNavigateToRegisterExpense,
}: BalanceTabProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('this_month');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('all');
  
  // Goal Target
  const [monthlyGoal, setMonthlyGoal] = useState<number>(1000);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('1000');

  // Notice for unmigrated table
  const [tableNotMigrated, setTableNotMigrated] = useState(false);

  useEffect(() => {
    loadExpenses();
    const savedGoal = localStorage.getItem('mec_monthly_goal');
    if (savedGoal) {
      const g = parseFloat(savedGoal);
      if (!isNaN(g) && g > 0) {
        setMonthlyGoal(g);
        setGoalInput(String(g));
      }
    }
  }, []);

  async function loadExpenses() {
    setLoadingExpenses(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          setTableNotMigrated(true);
          const local = JSON.parse(localStorage.getItem('mec_expenses') || '[]');
          setExpenses(local);
        } else {
          console.error('Error loading expenses:', error);
          const local = JSON.parse(localStorage.getItem('mec_expenses') || '[]');
          setExpenses(local);
        }
      } else {
        setTableNotMigrated(false);
        // Also check if any local expenses exist to merge
        const local = JSON.parse(localStorage.getItem('mec_expenses') || '[]');
        if (local.length > 0 && (!data || data.length === 0)) {
          setExpenses(local);
        } else {
          setExpenses(data ?? []);
        }
      }
    } catch (e) {
      console.error(e);
      const local = JSON.parse(localStorage.getItem('mec_expenses') || '[]');
      setExpenses(local);
    } finally {
      setLoadingExpenses(false);
    }
  }

  async function handleDeleteExpense(id: string) {
    if (!confirm('¿Estás seguro de que deseas eliminar este registro de gasto?')) return;

    try {
      if (!tableNotMigrated && !id.startsWith('local-')) {
        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if (error) throw error;
      }
      // Also remove from local storage if present
      const local = JSON.parse(localStorage.getItem('mec_expenses') || '[]');
      const filteredLocal = local.filter((e: Expense) => e.id !== id);
      localStorage.setItem('mec_expenses', JSON.stringify(filteredLocal));

      setExpenses((prev) => prev.filter((e) => e.id !== id));
      alert('Gasto eliminado con éxito.');
    } catch (err) {
      alert(`Error al eliminar el gasto: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function handleSaveGoal() {
    const val = parseFloat(goalInput);
    if (isNaN(val) || val <= 0) {
      alert('Por favor introduce un objetivo válido en euros.');
      return;
    }
    setMonthlyGoal(val);
    localStorage.setItem('mec_monthly_goal', String(val));
    setIsEditingGoal(false);
  }

  // Helper date filtering
  function isDateInPeriod(dateStr: string, filter: PeriodFilter): boolean {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const now = new Date();

    if (filter === 'all') return true;

    if (filter === 'this_month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }

    if (filter === 'last_30_days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      return d >= thirtyDaysAgo && d <= now;
    }

    if (filter === 'this_quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const recordQuarter = Math.floor(d.getMonth() / 3);
      return d.getFullYear() === now.getFullYear() && currentQuarter === recordQuarter;
    }

    if (filter === 'this_year') {
      return d.getFullYear() === now.getFullYear();
    }

    return true;
  }

  // Filtered sales
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (s.status === 'CANCELADA') return false;
      if (s.payment_type === 'RESERVA' && s.status === 'PRECOMPRA') return false;
      return isDateInPeriod(s.created_at, periodFilter);
    });
  }, [sales, periodFilter]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const dateToCompare = e.date || e.created_at || '';
      return isDateInPeriod(dateToCompare, periodFilter);
    });
  }, [expenses, periodFilter]);

  // Table search & category filtered expenses
  const displayedExpenses = useMemo(() => {
    return filteredExpenses.filter((e) => {
      if (expenseCategoryFilter !== 'all' && e.category !== expenseCategoryFilter) {
        return false;
      }
      if (expenseSearch.trim()) {
        const q = expenseSearch.toLowerCase().trim();
        const matchConcept = e.concept?.toLowerCase().includes(q);
        const matchSupplier = e.supplier?.toLowerCase().includes(q);
        const matchNotes = e.notes?.toLowerCase().includes(q);
        if (!matchConcept && !matchSupplier && !matchNotes) return false;
      }
      return true;
    });
  }, [filteredExpenses, expenseCategoryFilter, expenseSearch]);

  // Financial Metrics
  const totalRevenue = filteredSales.reduce((acc, s) => acc + Number(s.total_price), 0);
  const totalExpenses = filteredExpenses.reduce((acc, e) => acc + Number(e.amount), 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const roi = totalExpenses > 0 ? (netProfit / totalExpenses) * 100 : 0;
  const avgTicket = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0;

  // CRM: Online vs Presenciales
  const onlineSales = filteredSales.filter((s) => s.location?.toLowerCase().includes('online'));
  const presencialSales = filteredSales.filter((s) => !s.location?.toLowerCase().includes('online'));
  const onlineRevenue = onlineSales.reduce((acc, s) => acc + Number(s.total_price), 0);
  const presencialRevenue = presencialSales.reduce((acc, s) => acc + Number(s.total_price), 0);

  // Goal Progress (Current Month)
  const currentMonthSales = useMemo(() => {
    return sales.filter((s) => {
      if (s.status === 'CANCELADA') return false;
      if (s.payment_type === 'RESERVA' && s.status === 'PRECOMPRA') return false;
      return isDateInPeriod(s.created_at, 'this_month');
    });
  }, [sales]);
  const currentMonthRevenue = currentMonthSales.reduce((acc, s) => acc + Number(s.total_price), 0);
  const goalPercent = Math.min(100, monthlyGoal > 0 ? (currentMonthRevenue / monthlyGoal) * 100 : 0);
  const goalRemaining = Math.max(0, monthlyGoal - currentMonthRevenue);

  // Category Expenses Breakdown
  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const exp of filteredExpenses) {
      const cat = exp.category || 'OTROS';
      map[cat] = (map[cat] || 0) + Number(exp.amount);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredExpenses]);

  // Monthly timeline (last 6 months)
  const monthlyTimeline = useMemo(() => {
    const monthsData: { label: string; yearMonth: string; revenue: number; expenses: number; profit: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const monthName = d.toLocaleDateString('es-ES', { month: 'short' });
      const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
      const label = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${String(year).slice(2)}`;

      const rev = sales
        .filter((s) => {
          if (s.status === 'CANCELADA') return false;
          if (s.payment_type === 'RESERVA' && s.status === 'PRECOMPRA') return false;
          const sd = new Date(s.created_at);
          return sd.getFullYear() === year && sd.getMonth() === month;
        })
        .reduce((sum, s) => sum + Number(s.total_price), 0);

      const exp = expenses
        .filter((e) => {
          const ed = new Date(e.date || e.created_at || '');
          return ed.getFullYear() === year && ed.getMonth() === month;
        })
        .reduce((sum, e) => sum + Number(e.amount), 0);

      monthsData.push({
        label,
        yearMonth,
        revenue: rev,
        expenses: exp,
        profit: rev - exp,
      });
    }

    return monthsData;
  }, [sales, expenses]);

  const maxTimelineVal = Math.max(
    ...monthlyTimeline.map((m) => Math.max(m.revenue, m.expenses)),
    100
  );

  // CSV Export for Expenses
  function handleExportExpensesCSV() {
    if (displayedExpenses.length === 0) {
      alert('No hay gastos para exportar en este período.');
      return;
    }

    const headers = ['Fecha', 'Concepto', 'Categoría', 'Importe (€)', 'Método de Pago', 'Proveedor', 'Notas'];
    const rows = displayedExpenses.map((e) => [
      `"${e.date || ''}"`,
      `"${(e.concept || '').replace(/"/g, '""')}"`,
      `"${CATEGORY_LABELS[e.category]?.label || e.category}"`,
      Number(e.amount).toFixed(2),
      `"${e.payment_method || ''}"`,
      `"${(e.supplier || '').replace(/"/g, '""')}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `gastos_mec_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Notice if table was not migrated yet */}
      {tableNotMigrated && (
        <div style={{
          background: 'rgba(217, 119, 6, 0.1)',
          border: '1px solid rgba(217, 119, 6, 0.3)',
          borderRadius: '10px',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div>
            <strong style={{ color: '#d97706', fontSize: '13px' }}>⚠️ Almacenamiento Local Temporal Activo</strong>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              La tabla de gastos en Supabase aún no se ha creado. Los datos se guardan en tu navegador. Ejecuta el archivo <code>scratch/migration_phase7_expenses.sql</code> en Supabase SQL Editor para sincronización completa.
            </p>
          </div>
          <button
            type="button"
            onClick={loadExpenses}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              background: '#d97706',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Reintentar Conexión
          </button>
        </div>
      )}

      {/* Top Header Controls: Period Filter & Action Button */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: '12px',
        padding: '14px 20px',
      }}>
        {/* Period Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginRight: '4px' }}>
            Período:
          </span>
          {(
            [
              { id: 'this_month', label: 'Este Mes' },
              { id: 'last_30_days', label: 'Últimos 30 días' },
              { id: 'this_quarter', label: 'Este Trimestre' },
              { id: 'this_year', label: 'Este Año' },
              { id: 'all', label: 'Todo el Histórico' },
            ] as { id: PeriodFilter; label: string }[]
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriodFilter(p.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: periodFilter === p.id ? '1px solid #6366f1' : '1px solid var(--border-input)',
                background: periodFilter === p.id ? '#6366f1' : 'var(--bg-input)',
                color: periodFilter === p.id ? '#fff' : 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Quick CTA to register expense */}
        <button
          type="button"
          onClick={onNavigateToRegisterExpense}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 18px',
            borderRadius: '8px',
            border: 'none',
            background: '#10b981',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 800,
            cursor: 'pointer',
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#059669')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#10b981')}
        >
          <span>+ Registrar Nuevo Gasto</span>
        </button>
      </div>

      {/* Primary KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
      }}>
        {/* Ingresos */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Ingresos (Ventas)
            </span>
            <span style={{ fontSize: '18px' }}>📈</span>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, fontFamily: 'monospace', color: '#10b981' }}>
            {formatPrice(totalRevenue)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {filteredSales.length} pedidos en este período
          </div>
        </div>

        {/* Gastos */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Gastos Operativos
            </span>
            <span style={{ fontSize: '18px' }}>💸</span>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, fontFamily: 'monospace', color: '#ef4444' }}>
            {formatPrice(totalExpenses)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {filteredExpenses.length} apuntes de gasto
          </div>
        </div>

        {/* Beneficio Neto */}
        <div style={{
          background: 'var(--bg-card)',
          border: netProfit >= 0 ? '1.5px solid rgba(16, 185, 129, 0.4)' : '1.5px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Beneficio Neto
            </span>
            <span style={{
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 800,
              background: netProfit >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: netProfit >= 0 ? '#10b981' : '#ef4444',
            }}>
              {netProfit >= 0 ? 'RENTABLE' : 'DÉFICIT'}
            </span>
          </div>
          <div style={{
            fontSize: '26px',
            fontWeight: 800,
            fontFamily: 'monospace',
            color: netProfit >= 0 ? '#10b981' : '#ef4444',
          }}>
            {formatPrice(netProfit)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Margen de rentabilidad: <strong>{profitMargin.toFixed(1)}%</strong>
          </div>
        </div>

        {/* Margen & ROI */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Ticket Medio & ROI
            </span>
            <span style={{ fontSize: '18px' }}>🎯</span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'monospace' }}>
            {formatPrice(avgTicket)} <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>/ticket</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Retorno Inversión (ROI): <strong style={{ color: roi >= 0 ? '#10b981' : '#ef4444' }}>{roi.toFixed(1)}%</strong>
          </div>
        </div>
      </div>

      {/* Goal & CRM Channels Card Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '16px',
      }}>
        {/* Monthly Target (Objetivo del Mes) */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800 }}>Objetivo Mensual de Facturación</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Meta fijada para el mes actual
              </p>
            </div>
            {isEditingGoal ? (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  type="number"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  style={{
                    width: '80px',
                    padding: '4px 6px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-input)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                />
                <button
                  type="button"
                  onClick={handleSaveGoal}
                  style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', background: '#10b981', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                >
                  ✓
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingGoal(false)}
                  style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', background: 'var(--bg-input)', color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingGoal(true)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-input)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-secondary)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ✏️ Ajustar Meta
              </button>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'monospace' }}>
              {formatPrice(currentMonthRevenue)}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Meta: <strong>{formatPrice(monthlyGoal)}</strong> ({goalPercent.toFixed(1)}%)
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ width: '100%', height: '10px', background: 'var(--bg-input)', borderRadius: '5px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${goalPercent}%`,
                height: '100%',
                background: goalPercent >= 100 ? '#10b981' : 'linear-gradient(90deg, #6366f1, #3b82f6)',
                borderRadius: '5px',
                transition: 'width 0.5s ease',
              }}
            />
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
            <span>
              {goalRemaining > 0 ? (
                <>Faltan <strong>{formatPrice(goalRemaining)}</strong> para cumplir la meta</>
              ) : (
                <strong style={{ color: '#10b981' }}>🎉 ¡Objetivo del mes superado!</strong>
              )}
            </span>
            <span>{currentMonthSales.length} ventas este mes</span>
          </div>
        </div>

        {/* CRM Sales by Channel (Online vs Presencial) */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800 }}>Canales de Venta (CRM)</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Desglose entre ventas online y eventos presenciales
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Online */}
            <div style={{
              background: 'var(--bg-input)',
              borderRadius: '8px',
              padding: '12px',
              border: '1px solid var(--border-input)',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                🌐 Online (Web)
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'monospace', marginTop: '4px', color: '#3b82f6' }}>
                {formatPrice(onlineRevenue)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {onlineSales.length} ventas ({totalRevenue > 0 ? ((onlineRevenue / totalRevenue) * 100).toFixed(0) : 0}%)
              </div>
            </div>

            {/* Presencial */}
            <div style={{
              background: 'var(--bg-input)',
              borderRadius: '8px',
              padding: '12px',
              border: '1px solid var(--border-input)',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                🤝 Presenciales (Ferias/Taller)
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'monospace', marginTop: '4px', color: '#10b981' }}>
                {formatPrice(presencialRevenue)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {presencialSales.length} ventas ({totalRevenue > 0 ? ((presencialRevenue / totalRevenue) * 100).toFixed(0) : 0}%)
              </div>
            </div>
          </div>

          {/* Quick channel bar */}
          <div style={{ display: 'flex', width: '100%', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${totalRevenue > 0 ? (onlineRevenue / totalRevenue) * 100 : 50}%`, background: '#3b82f6' }} title="Online" />
            <div style={{ width: `${totalRevenue > 0 ? (presencialRevenue / totalRevenue) * 100 : 50}%`, background: '#10b981' }} title="Presencial" />
          </div>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '16px',
      }}>
        {/* Timeline Chart (Ingresos vs Gastos en los últimos 6 meses) */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: '12px',
          padding: '20px',
        }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 800 }}>Evolución Semestral</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Comparativa de facturación e inversión mes a mes
          </p>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '160px', gap: '8px', paddingTop: '10px' }}>
            {monthlyTimeline.map((item, idx) => {
              const revHeight = (item.revenue / maxTimelineVal) * 120;
              const expHeight = (item.expenses / maxTimelineVal) * 120;

              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' }}>
                  {/* Bars side by side */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', width: '100%', justifyContent: 'center' }}>
                    {/* Revenue bar */}
                    <div
                      title={`Ingresos ${item.label}: ${formatPrice(item.revenue)}`}
                      style={{
                        width: '12px',
                        height: `${Math.max(4, revHeight)}px`,
                        background: '#10b981',
                        borderRadius: '3px 3px 0 0',
                        transition: 'height 0.3s ease',
                      }}
                    />
                    {/* Expense bar */}
                    <div
                      title={`Gastos ${item.label}: ${formatPrice(item.expenses)}`}
                      style={{
                        width: '12px',
                        height: `${Math.max(4, expHeight)}px`,
                        background: '#ef4444',
                        borderRadius: '3px 3px 0 0',
                        transition: 'height 0.3s ease',
                      }}
                    />
                  </div>
                  {/* Month Label */}
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '8px', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '2px' }} /> Ingresos
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '2px' }} /> Gastos
            </span>
          </div>
        </div>

        {/* Expenses by Category Breakdown */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: '12px',
          padding: '20px',
        }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 800 }}>Distribución de Gastos</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Porcentaje de inversión por categoría en este período
          </p>

          {expensesByCategory.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
              No hay gastos registrados en este período.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {expensesByCategory.map(([cat, amt]) => {
                const conf = CATEGORY_LABELS[cat] || { label: cat, icon: '📌', color: '#6b7280' };
                const pct = totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0;

                return (
                  <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                        <span>{conf.icon}</span> {conf.label}
                      </span>
                      <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                        {formatPrice(amt)} <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>({pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: conf.color,
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Expenses History Table */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: '12px',
        padding: '20px',
      }}>
        {/* Table Header & Controls */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Historial de Gastos</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Detalle y contabilidad de todos los costes registrados
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search Input */}
            <input
              type="text"
              placeholder="Buscar por concepto, notas..."
              value={expenseSearch}
              onChange={(e) => setExpenseSearch(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-input)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                width: '180px',
              }}
            />

            {/* Category Filter */}
            <select
              value={expenseCategoryFilter}
              onChange={(e) => setExpenseCategoryFilter(e.target.value)}
              style={{
                padding: '7px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-input)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              <option value="all">Todas las Categorías</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportExpensesCSV}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-input)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Exportar gastos del período a CSV"
            >
              📥 Exportar CSV
            </button>
          </div>
        </div>

        {/* Expenses List / Table */}
        <div style={{ overflowX: 'auto' }}>
          {loadingExpenses ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando gastos...</div>
          ) : displayedExpenses.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
              No hay gastos registrados en esta vista. Pulsa en <strong>"+ Registrar Nuevo Gasto"</strong> para añadir uno.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-card)', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px' }}>Fecha</th>
                  <th style={{ padding: '10px 12px' }}>Concepto</th>
                  <th style={{ padding: '10px 12px' }}>Categoría</th>
                  <th style={{ padding: '10px 12px' }}>Método</th>
                  <th style={{ padding: '10px 12px' }}>Proveedor</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Importe</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {displayedExpenses.map((exp) => {
                  const catConf = CATEGORY_LABELS[exp.category] || { label: exp.category, icon: '📌', color: '#6b7280' };

                  return (
                    <tr
                      key={exp.id}
                      style={{ borderBottom: '1px solid var(--border-card-glass)', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {exp.date ? new Date(exp.date).toLocaleDateString('es-ES') : '-'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 700 }}>{exp.concept}</div>
                        {exp.notes && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{exp.notes}</div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: `${catConf.color}22`,
                          color: catConf.color,
                        }}>
                          <span>{catConf.icon}</span> {catConf.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {exp.payment_method || '-'}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                        {exp.supplier || '-'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', color: '#ef4444', whiteSpace: 'nowrap' }}>
                        -{formatPrice(exp.amount)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(exp.id)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '5px',
                            border: 'none',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            fontSize: '12px',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                          }}
                          title="Eliminar gasto"
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
