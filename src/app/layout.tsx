import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Image from "next/image";
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
      <body className="bg-neutral-50 text-neutral-900 antialiased flex flex-col min-h-screen">
        <div className="flex-1">
          {children}
        </div>
        <footer className="py-8 flex flex-col items-center gap-2 border-t border-neutral-100">
          <Image
            src="/logo_txt.png"
            alt="MiniEngines Creations"
            width={200}
            height={40}
            style={{ height: 'auto', opacity: 0.35 }}
          />
        </footer>
      </body>
    </html>
  );
}
