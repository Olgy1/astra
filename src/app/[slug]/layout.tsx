import type { ReactNode } from "react";
import "./public.css";

/**
 * Layout des pages publiques.
 *
 * N'existe que pour charger `public.css` (les keyframes des effets) sur ce
 * segment uniquement. Le layout racine fournit déjà `<html>` et `<body>`.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return children;
}
