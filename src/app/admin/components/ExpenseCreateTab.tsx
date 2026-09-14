'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ExpenseCategory } from '@/lib/types';
import styles from '../admin.module.css';

interface ExpenseCreateTabProps {
  onExpenseCreated: () => void;
  onCancel: () => void;
}

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'MATERIALES', label: '🧵 Materiales / Filamento / Stock' },
  { value: 'ENVIOS', label: '📦 Envíos / Paquetería' },
  { value: 'PACKAGING', label: '🏷️ Packaging / Cajas / Embalaje' },
  { value: 'HERRAMIENTAS', label: '🛠️ Herramientas / Maquinaria' },
  { value: 'MARKETING', label: '📢 Publicidad / Marketing' },
  { value: 'EVENTOS', label: '🎪 Ferias / Eventos Presenciales' },
  { value: 'SERVICIOS', label: '💻 Software / Dominio / Hosting' },
  { value: 'IMPUESTOS', label: '🧾 Impuestos / Gestoría' },
  { value: 'OTROS', label: '📌 Otros Gastos' },
];

const PRESETS = [
  { label: '🧵 Bobina Filamento (20 €)', concept: 'Bobina Filamento PLA', amount: '20.00', category: 'MATERIALES' as ExpenseCategory },
  { label: '📦 Envío Correos (5.50 €)', concept: 'Envío Paquetería Correos', amount: '5.50', category: 'ENVIOS' as ExpenseCategory },
  { label: '🏷️ Cajas Packaging (15 €)', concept: 'Cajas y material de embalaje', amount: '15.00', category: 'PACKAGING' as ExpenseCategory },
  { label: '🛠️ Recambio Impresora (12 €)', concept: 'Boquilla / Recambio impresora 3D', amount: '12.00', category: 'HERRAMIENTAS' as ExpenseCategory },
  { label: '🎪 Stand / Feria (50 €)', concept: 'Cuota de participación en feria', amount: '50.00', category: 'EVENTOS' as ExpenseCategory },
];

export default function ExpenseCreateTab({
  onExpenseCreated,
  onCancel,
}: ExpenseCreateTabProps) {
  const todayStr = new Date().toISOString().split('T')[0];

  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('MATERIALES');
  const [date, setDate] = useState(todayStr);
  const [paymentMethod, setPaymentMethod] = useState('TARJETA');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  function applyPreset(p: typeof PRESETS[0]) {
    setConcept(p.concept);
    setAmount(p.amount);
    setCategory(p.category);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedConcept = concept.trim();
    const numAmount = parseFloat(amount);

    if (!trimmedConcept) {
      alert('Por favor indica el concepto o descripción del gasto.');
      return;
    }

    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Por favor indica un importe válido mayor que cero.');
      return;
    }

    setLoading(true);

    const expensePayload = {
      concept: trimmedConcept,
      amount: numAmount,
      category,
      date: date || todayStr,
      payment_method: paymentMethod || null,
      supplier: supplier.trim() || null,
      notes: notes.trim() || null,
    };

    try {
      const { error } = await supabase
        .from('expenses')
        .insert(expensePayload);

      if (error) {
        // Fallback: If table does not exist in Supabase yet, save in localStorage
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.warn('[Expenses] Table does not exist in Supabase. Using localStorage fallback.');
          const localSaved = JSON.parse(localStorage.getItem('mec_expenses') || '[]');
          const newExpense = {
            id: `local-${Date.now()}`,
            ...expensePayload,
            created_at: new Date().toISOString(),
          };
          localStorage.setItem('mec_expenses', JSON.stringify([newExpense, ...localSaved]));
          alert('¡Gasto registrado con éxito! (Guardado localmente. Recuerda ejecutar el script scratch/migration_phase7_expenses.sql en Supabase para sincronizarlo en la nube).');
          onExpenseCreated();
          return;
        }
        throw error;
      }

      alert('¡Gasto registrado correctamente en el balance!');
      onExpenseCreated();
    } catch (err) {
      console.error('Error saving expense:', err);
      // Fallback local storage
      const localSaved = JSON.parse(localStorage.getItem('mec_expenses') || '[]');
      const newExpense = {
        id: `local-${Date.now()}`,
        ...expensePayload,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('mec_expenses', JSON.stringify([newExpense, ...localSaved]));
      alert('¡Gasto guardado! (Guardado en almacenamiento local tras fallo de red).');
      onExpenseCreated();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto' }}>
      {/* Quick Presets */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '24px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          ⚡ Atajos Rápidos de Gastos Frecuentes
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyPreset(p)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-input)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--text-primary)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-input)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Expense Form */}
      <form onSubmit={handleSubmit} style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: '14px',
        padding: '28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}>
        <div style={{ borderBottom: '1px solid var(--border-card)', paddingBottom: '14px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Detalles del Gasto</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Introduce los datos para computarlo en el balance contable y restar de los beneficios.
          </p>
        </div>

        {/* Concepto & Importe */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className={styles.formLabel}>
              Concepto / Descripción <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Ej. 2 Bobinas de Filamento PLA Negro"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className={styles.salesTextInput}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className={styles.formLabel}>
              Importe (€) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={styles.salesTextInput}
                style={{ paddingRight: '28px', fontWeight: 800, fontFamily: 'monospace' }}
                required
              />
              <span style={{ position: 'absolute', right: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>€</span>
            </div>
          </div>
        </div>

        {/* Categoría & Fecha */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className={styles.formLabel}>Categoría del Gasto</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className={styles.salesTextInput}
              style={{ cursor: 'pointer', fontWeight: 600 }}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className={styles.formLabel}>Fecha del Gasto</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={styles.salesTextInput}
              style={{ fontWeight: 600 }}
              required
            />
          </div>
        </div>

        {/* Método de Pago & Proveedor */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className={styles.formLabel}>Método de Pago</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className={styles.salesTextInput}
              style={{ cursor: 'pointer', fontWeight: 600 }}
            >
              <option value="TARJETA">💳 Tarjeta Bancaria</option>
              <option value="EFECTIVO">💵 Efectivo</option>
              <option value="BIZUM">📱 Bizum</option>
              <option value="TRANSFERENCIA">🏦 Transferencia</option>
              <option value="DOMICILIACION">📄 Domiciliación / Recibo</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className={styles.formLabel}>Proveedor / Tienda (Opcional)</label>
            <input
              type="text"
              placeholder="Ej. Amazon, Correos, Bambu Lab..."
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className={styles.salesTextInput}
            />
          </div>
        </div>

        {/* Notas / Observaciones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className={styles.formLabel}>Notas / Observaciones (Opcional)</label>
          <textarea
            rows={3}
            placeholder="Detalles adicionales, número de factura o referencia del pedido..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{
              width: '100%',
              borderRadius: '8px',
              border: '1px solid var(--border-input)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              padding: '10px 12px',
              fontSize: '13px',
              resize: 'vertical',
              boxSizing: 'border-box',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Form Actions */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px', borderTop: '1px solid var(--border-card)', paddingTop: '18px' }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              flex: 2,
              padding: '12px 20px',
              borderRadius: '8px',
              border: 'none',
              background: '#10b981',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#059669'; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#10b981'; }}
          >
            {loading ? 'Guardando...' : '✓ Guardar Gasto'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px 20px',
              borderRadius: '8px',
              border: '1px solid var(--border-input)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background 0.2s ease',
            }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
