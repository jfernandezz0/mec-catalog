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

export default function ExpenseCreateTab({
  onExpenseCreated,
  onCancel,
}: ExpenseCreateTabProps) {
  const todayStr = new Date().toISOString().split('T')[0];

  const [concept, setConcept] = useState('');
  const [units, setUnits] = useState('1');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('MATERIALES');
  const [date, setDate] = useState(todayStr);
  const [paymentMethod, setPaymentMethod] = useState('TARJETA');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const parsedUnits = parseInt(units, 10);
  const numUnits = !isNaN(parsedUnits) && parsedUnits > 0 ? parsedUnits : 1;
  const numAmount = parseFloat(amount);
  const unitCost = !isNaN(numAmount) && numAmount > 0 && numUnits > 0 ? numAmount / numUnits : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedConcept = concept.trim();

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
      units: numUnits,
      category,
      date: date || todayStr,
      payment_method: paymentMethod || null,
      supplier: supplier.trim() || null,
      notes: notes.trim() || null,
    };

    try {
      let { error } = await supabase
        .from('expenses')
        .insert(expensePayload);

      // Graceful fallback if the units column doesn't exist yet in Supabase
      if (error && (error.code === '42703' || error.message?.includes('units'))) {
        console.warn('[Expenses] Column "units" not found in Supabase schema. Retrying without units column...');
        const annotatedNotes = notes.trim()
          ? `${notes.trim()}\n[Lote: ${numUnits} uds · ${(numAmount / numUnits).toFixed(2)} €/ud]`
          : `[Lote: ${numUnits} uds · ${(numAmount / numUnits).toFixed(2)} €/ud]`;
        const fallbackPayload: Record<string, unknown> = {
          ...expensePayload,
          notes: annotatedNotes,
        };
        delete fallbackPayload.units;
        const retryResult = await supabase.from('expenses').insert(fallbackPayload);
        error = retryResult.error;
      }

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
            Introduce los datos para computarlo en el balance contable y calcular el coste unitario del material.
          </p>
        </div>

        {/* Concepto / Descripción */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className={styles.formLabel}>
            Concepto / Descripción <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            placeholder="Ej. COCHES LEGO, Bobinas Filamento PLA..."
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            className={styles.salesTextInput}
            required
          />
        </div>

        {/* Unidades & Importe Total */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className={styles.formLabel}>
              Unidades / Cantidad <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="1"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                className={styles.salesTextInput}
                style={{ paddingRight: '46px', fontWeight: 700 }}
                required
              />
              <span style={{ position: 'absolute', right: '12px', fontWeight: 600, fontSize: '12px', color: 'var(--text-secondary)' }}>
                uds
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Cantidad de piezas/material para repartir el coste
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className={styles.formLabel}>
              Importe Total (€) <span style={{ color: '#ef4444' }}>*</span>
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
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Gasto total unificado de la compra
            </span>
          </div>
        </div>

        {/* Banner de Coste Medio Unitario */}
        {numUnits > 1 && !isNaN(numAmount) && numAmount > 0 && unitCost !== null && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(99, 102, 241, 0.08) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '10px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '22px' }}>⚖️</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#10b981' }}>
                  Coste Medio Unitario: {unitCost.toFixed(2).replace('.', ',')} € / unidad
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Gasto de {numAmount.toFixed(2).replace('.', ',')} € distribuido equitativamente entre {numUnits} unidades. Mismo coste base para cualquier modelo.
                </div>
              </div>
            </div>
            <div style={{
              background: '#10b981',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: '6px',
              fontWeight: 800,
              fontFamily: 'monospace',
              fontSize: '13px',
              whiteSpace: 'nowrap',
            }}>
              {unitCost.toFixed(2).replace('.', ',')} €/ud
            </div>
          </div>
        )}

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
