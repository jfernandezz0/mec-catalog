/** @type {import('next').NextConfig} */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "");

let supabaseHostname = undefined;
if (supabaseUrl) {
  try {
    supabaseHostname = new URL(supabaseUrl).hostname;
  } catch (err) {
    console.error("[next.config.mjs] Error parsing URL:", err);
  }
}

const nextConfig = {
  images: {
    // Almacena las imágenes transformadas en caché durante 1 año (31536000 segundos)
    minimumCacheTTL: 31536000,
    // Limitamos los tamaños de dispositivo a los requeridos por la app (reduciendo de 8 a 3 por defecto)
    deviceSizes: [640, 828, 1200],
    // Limitamos los tamaños de imagen (reduciendo de 8 a 4 por defecto)
    imageSizes: [48, 96, 256, 384],
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: "https",
            hostname: supabaseHostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;

