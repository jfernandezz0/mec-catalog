/** @type {import('next').NextConfig} */
console.log("[next.config.mjs] Loading config...");
console.log("[next.config.mjs] NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "");
console.log("[next.config.mjs] Parsed supabaseUrl:", supabaseUrl);

let supabaseHostname = undefined;
if (supabaseUrl) {
  try {
    supabaseHostname = new URL(supabaseUrl).hostname;
    console.log("[next.config.mjs] Parsed supabaseHostname:", supabaseHostname);
  } catch (err) {
    console.error("[next.config.mjs] Error parsing URL:", err);
  }
}

const nextConfig = {
  images: {
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

console.log("[next.config.mjs] Generated nextConfig:", JSON.stringify(nextConfig, null, 2));

export default nextConfig;
