import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import ConnectionStatus from "./components/ConnectionStatus";
import ThemeToggle from "./components/ThemeToggle";
import Footer from "./components/Footer";
import CartButton from "./components/CartButton";
import CartDrawer from "./components/CartDrawer";
import { CartProvider } from "@/lib/contexts/CartContext";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./tailwind.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.minienginescreations.com"),
  title: "MiniEngines Creations",
  description: "Catálogo digital de artículos y ediciones limitadas de miniaturas de coches.",
  alternates: {
    canonical: "/",
  },
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
    <html lang="es" className={jakarta.className} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MiniEngines" />
        <meta name="theme-color" content="#171717" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme');
                  if (theme === 'light') {
                    document.documentElement.classList.add('light');
                  } else {
                    // Default to dark (first visit or explicit dark preference)
                    document.documentElement.classList.add('dark');
                    if (!theme) localStorage.setItem('theme', 'dark');
                  }
                } catch (e) {
                  document.documentElement.classList.add('dark');
                }
                
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
        <CartProvider>
          <ConnectionStatus />
          <ThemeToggle />
          <CartButton />
          <CartDrawer />
          <div className="flex-1">
            {children}
          </div>
          <Footer />
          <SpeedInsights />
        </CartProvider>
      </body>
    </html>
  );
}
