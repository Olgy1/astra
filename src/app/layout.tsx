import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Astra — votre bio, votre page",
    // Les pages publiques et les panels complètent ce gabarit.
    template: "%s · Astra",
  },
  description:
    "Créez une page unique pour tous vos liens, réseaux et médias. Personnalisable à l'extrême, prête en deux minutes.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // On ne bloque pas le zoom : le trafic est mobile et empêcher de zoomer
  // rend la page inutilisable pour les personnes malvoyantes.
  maximumScale: 5,
  themeColor: "#0a0a0f",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
