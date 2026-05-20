import Image from 'next/image';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-6 text-center">
      <div className="mb-6 animate-pulse">
        <Image
          src="/logo_mini.png"
          alt="MiniEngines Creations Logo"
          width={80}
          height={80}
          priority
        />
      </div>
      <h1 className="text-xl md:text-2xl font-extrabold text-neutral-900 max-w-md leading-relaxed mb-4">
        El ingeniero jefe hizo algo mal, lo sentimos.<br />
        Volveremos lo antes posible.
      </h1>
      <p className="text-neutral-500 mb-8 text-sm">
        Esta página no existe o ha sido movida.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/"
          className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-bold rounded-lg text-white bg-neutral-900 hover:bg-neutral-800 transition-colors shadow-sm"
        >
          Ir al Catálogo
        </Link>
        <a
          href="https://www.instagram.com/minienginescreations"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center px-6 py-3 border border-neutral-200 text-sm font-bold rounded-lg text-neutral-700 bg-white hover:bg-neutral-50 transition-colors"
        >
          Instagram
        </a>
      </div>
    </div>
  );
}
