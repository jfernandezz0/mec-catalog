'use client';

import AdminLogin from '../components/AdminLogin';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/admin');
      }
    });
  }, [router]);

  return <AdminLogin onLoginSuccess={() => router.replace('/admin')} />;
}
