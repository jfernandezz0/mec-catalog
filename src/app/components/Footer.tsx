'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();

  // Hide the footer on the admin panel
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <footer className="py-8 flex flex-col items-center gap-6 border-t border-[color:var(--border-card)]">
      <div className="flex flex-col items-center text-center text-xs text-[color:var(--text-secondary)] px-4 max-w-md leading-relaxed gap-2.5">
        <span>Colabora con el equipo de ingeniería aquí:</span>
        <a
          href="https://revolut.me/jfernandezz?currency=EUR&amount=0100&note=MEC%20%7C%20MINIENGINES%20-%20ALPISTE%20PARA%20EL%20INGENIERO"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center p-3 rounded-full bg-[color:var(--bg-card)] hover:bg-red-500/10 border border-[color:var(--border-card)] hover:border-red-500 text-[color:var(--text-primary)] hover:text-red-500 transition-all hover:scale-110 shadow-sm hover:shadow-md hover:shadow-red-500/20"
          title="Colaborar con el equipo de ingeniería"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
          >
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </a>
        <span>se lo gastarán todo en nuevas herramientas y gasolina 98.</span>
      </div>
      <Image
        src="/logo_txt.png"
        alt="MiniEngines Creations"
        width={200}
        height={40}
        style={{ height: 'auto', opacity: 0.35, filter: 'invert(var(--logo-invert, 0))' }}
      />
    </footer>
  );
}
