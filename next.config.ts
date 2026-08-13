import type { NextConfig } from "next";
import path from "node:path";

const s3Host = process.env.S3_PUBLIC_HOST;

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Next infère la racine du workspace en remontant jusqu'au premier lockfile
  // trouvé. Un yarn.lock traîne à la racine du dossier personnel
  // (/Users/kyle-edward/yarn.lock), ce qui fait prendre tout le home (Desktop
  // et Documents iCloud, SteamLibrary, MEGA…) comme racine : le watcher de
  // dev scanne un arbre énorme en continu, et le démarrage comme les requêtes
  // de l'éditeur peuvent bloquer pendant 30-180 s. On fige la racine sur le
  // projet.
  outputFileTracingRoot: path.join(__dirname),

  // Les médias sont servis depuis S3/CDN. On n'autorise que cet hôte plus les
  // CDN des fournisseurs OAuth dont on affiche les avatars.
  images: {
    remotePatterns: [
      ...(s3Host ? [{ protocol: "https" as const, hostname: s3Host }] : []),
      { protocol: "https" as const, hostname: "cdn.discordapp.com" },
    ],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
