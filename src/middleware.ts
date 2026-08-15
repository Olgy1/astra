import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Garde de routes.
 *
 * Redirige les visiteurs non connectés hors de /panel et /admin, et les
 * connectés hors des pages d'authentification.
 *
 * Le middleware tourne sur le runtime Edge : pas d'accès à Prisma, donc pas
 * de lecture de la base. Il ne vérifie que la signature du JWT. Ce n'est
 * PAS la garde de sécurité — un utilisateur banni ou rétrogradé passerait ici
 * jusqu'à l'expiration de son token. La vraie vérification est faite par
 * `requireUser` / `requireAdmin`, qui relisent la base à chaque appel.
 *
 * Le rôle de ce fichier est d'éviter un aller-retour inutile : afficher la
 * page de login sans avoir chargé le panel pour rien.
 */

const PROTECTED_PREFIXES = ["/panel", "/admin"];
const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

const ACCESS_COOKIE = "astra_at";

async function hasValidToken(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return false;

  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) return false;

  try {
    await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: "astraa.is-cool.dev",
      audience: "astraa.is-cool.dev/api",
      algorithms: ["HS256"],
    });
    return true;
  } catch {
    // Token expiré : on renvoie false. Le client a un refresh token, mais le
    // middleware ne peut pas s'en servir (rotation = écriture en base). La
    // page de login détectera la session récupérable côté client.
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authenticated = await hasValidToken(request);

  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    if (!authenticated) {
      const loginUrl = new URL("/login", request.url);
      // On mémorise la destination pour y renvoyer après connexion, plutôt
      // que de déposer l'utilisateur sur un panel générique.
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (AUTH_PAGES.includes(pathname) && authenticated) {
    return NextResponse.redirect(new URL("/panel", request.url));
  }

  return NextResponse.next();
}

export const config = {
  /**
   * On exclut les assets et les routes API.
   *
   * `/api` en particulier : les route handlers font leur propre contrôle et
   * doivent répondre en JSON. Les laisser passer par ce middleware
   * transformerait un 401 attendu par le client en redirection HTML vers
   * /login, que `apiFetch` ne saurait pas interpréter.
   */
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|mp4|webm|mp3|woff|woff2)$).*)"],
};
