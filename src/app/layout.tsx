import type { Metadata, Viewport } from "next";
import {
  Inter,
  JetBrains_Mono,
  Montserrat,
  Playfair_Display,
  Poppins,
} from "next/font/google";
import "./globals.css";
import "./fonts.css";

/**
 * Polices du catalogue, chargées au build et auto-hébergées (aucun appel à
 * Google Fonts à l'exécution, pas de flash de police).
 *
 * Chacune expose une variable CSS (`--font-inter`, `--font-poppins`…) que
 * `fontFamilyCss` (lib/theme/fonts.ts) référence dans `--page-font` et dans
 * les blocks. Sans ce chargement, `font-family: "Poppins"` ne correspond à
 * aucune police installée chez le visiteur : la page retombait sur la police
 * système par défaut, quel que soit le choix — c'était le bug « la police ne
 * change jamais ».
 */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});
const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

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
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${inter.variable} ${poppins.variable} ${montserrat.variable} ${jetbrainsMono.variable} ${playfairDisplay.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
