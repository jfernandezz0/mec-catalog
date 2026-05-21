import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Image from "next/image";
import ConnectionStatus from "./components/ConnectionStatus";
import ThemeToggle from "./components/ThemeToggle";
import "./tailwind.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MiniEngines Creations",
  description: "Catálogo digital de artículos y ediciones limitadas de miniaturas de coches.",
  icons: {
    icon: "/MEC_square.png",
    apple: "/MEC_square.png",
  },
  openGraph: {
    title: "MiniEngines Creations",
    description: "Catálogo digital de artículos y ediciones limitadas de miniaturas de coches.",
    url: "https://mec-catalog.vercel.app",
    siteName: "MiniEngines Creations",
    locale: "es_ES",
    type: "website",
    images: [
      {
        url: "https://mec-catalog.vercel.app/logo.png",
        width: 800,
        height: 300,
        alt: "MiniEngines Creations",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MiniEngines Creations",
    description: "Catálogo digital de artículos y ediciones limitadas de miniaturas de coches.",
    images: ["https://mec-catalog.vercel.app/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={jakarta.className}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#171717" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme');
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else if (theme === 'light') {
                    document.documentElement.classList.add('light');
                  }
                } catch (e) {}
                
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').catch(function(err) {
                      console.error('Service Worker registration failed:', err);
                    });
                  });
                }
              })();
            `,
          }}
        />
      </head>
      <body className="bg-[color:var(--bg-page)] text-[color:var(--text-primary)] antialiased flex flex-col min-h-screen">
        <ConnectionStatus />
        <ThemeToggle />
        <div className="flex-1">
          {children}
        </div>
        <footer className="py-8 flex flex-col items-center gap-6 border-t border-[color:var(--border-card)]">
          <div className="flex flex-col items-center text-center text-xs text-[color:var(--text-secondary)] px-4 max-w-md leading-relaxed gap-2.5">
            <span>Colabora con el equipo de ingeniería aquí:</span>
            <a
              href="https://revolut.me/jfernandezz?currency=EUR&amount=0100&note=MEC%20%7C%20MINIENGINES%20-%20ALPISTE%20PARA%20EL%20INGENIERO"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center p-2 rounded-full bg-[color:var(--bg-card)] hover:bg-red-500/10 border border-[color:var(--border-card)] hover:border-red-500 text-[color:var(--text-primary)] hover:text-red-500 transition-all hover:scale-110 shadow-sm hover:shadow-md hover:shadow-red-500/20"
              title="Colaborar con el equipo de ingeniería"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3.5 h-3.5"
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
      </body>
    </html>
  );
}
