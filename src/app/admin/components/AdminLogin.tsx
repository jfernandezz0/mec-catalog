'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import styles from '../admin.module.css';

interface AdminLoginProps {
  onLoginSuccess?: () => void;
}

export default function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

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
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al iniciar sesión.');
    } finally {
      setAuthLoading(false);
    }
  }

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
