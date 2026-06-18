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
      <h1
        className="text-xl md:text-2xl font-extrabold max-w-md leading-relaxed mb-4"
        style={{ color: 'var(--text-primary)' }}
      >
        El ingeniero jefe hizo algo mal, lo sentimos.<br />
        Volveremos lo antes posible.
      </h1>
      <p
        className="mb-8 text-sm"
        style={{ color: 'var(--text-secondary)' }}
      >
        Esta página no existe o ha sido movida.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/"
          className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-bold rounded-lg transition-colors shadow-sm"
          style={{
            color: 'var(--text-button-primary)',
            backgroundColor: 'var(--bg-button-primary)',
          }}
        >
          Ir al Catálogo
        </Link>
        <a
          href="https://www.instagram.com/minienginescreations"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center px-6 py-3 border text-sm font-bold rounded-lg transition-colors"
          style={{
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--text-secondary)',
          }}
        >
          Instagram
        </a>
      </div>
    </div>
  );
}
