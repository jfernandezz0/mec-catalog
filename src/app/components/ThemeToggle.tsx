'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SunIcon, MoonIcon } from '@/app/components/Icons';

export default function ThemeToggle() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  // Hide theme toggle on admin panel routes
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  useEffect(() => {
    // Find current active theme on client
    const isDark = document.documentElement.classList.contains('dark') ||
      (!document.documentElement.classList.contains('light') && 
       window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    setTimeout(() => {
      setMounted(true);
      setTheme(isDark ? 'dark' : 'light');
    }, 0);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    
    setTheme(nextTheme);
  };

  if (!mounted) {
    // Render a placeholder button with matching size and shape to avoid layout shift
    return (
      <div className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full border border-[color:var(--border-card)] bg-[color:var(--bg-card)]/50 backdrop-blur-md opacity-0 noPrint" />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="fixed top-4 right-4 z-50 flex items-center justify-center w-10 h-10 rounded-full border border-[color:var(--border-card)] bg-[color:var(--bg-card)]/50 text-[color:var(--text-primary)] backdrop-blur-md hover:bg-[color:var(--bg-card)] shadow-sm hover:shadow transition-all duration-300 focus:outline-none cursor-pointer noPrint"
      aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
    >
      {theme === 'dark' ? (
        // Sun Icon (shown in dark mode)
        <SunIcon width="20" height="20" />
      ) : (
        // Moon Icon (shown in light mode)
        <MoonIcon width="20" height="20" />
      )}
    </button>
  );
}
