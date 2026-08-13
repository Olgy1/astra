import type { ApiErrorCode } from "@/lib/api";

/**
 * Client HTTP du front.
 *
 * Normalise le contrat `{ ok, data | error }` en un résultat discriminé, et
 * gère le rafraîchissement transparent de l'access token.
 */

export type ApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: ApiErrorCode | "NETWORK_ERROR";
      message: string;
      fields?: Record<string, string[]>;
    };

type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ApiErrorCode; message: string; fields?: Record<string, string[]> } };

/**
 * Une seule promesse de refresh à la fois.
 *
 * Sans ce verrou, trois requêtes qui expirent ensemble déclenchent trois
 * refresh concurrents. Comme le refresh token tourne à chaque usage, les deux
 * derniers présenteraient un token déjà consommé, échoueraient, et
 * déconnecteraient l'utilisateur — un bug qui ne se voit qu'en conditions
 * réelles, quand plusieurs appels partent en parallèle.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "same-origin",
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      // Libéré dans un finally : une exception laisserait sinon le verrou
      // posé pour toujours, et plus aucun refresh ne pourrait aboutir.
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Interne : empêche une boucle de refresh infinie. */
  _retried?: boolean;
};

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResult<T>> {
  const { method = "GET", body, _retried = false } = options;

  let response: Response;

  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return {
      ok: false,
      code: "NETWORK_ERROR",
      message: "Connexion impossible. Vérifiez votre accès à internet.",
    };
  }

  // 401 sur une route qui n'est pas l'auth : l'access token a probablement
  // expiré. On rafraîchit et on rejoue une fois.
  if (
    response.status === 401 &&
    !_retried &&
    !path.startsWith("/api/auth/login") &&
    !path.startsWith("/api/auth/refresh")
  ) {
    if (await refreshAccessToken()) {
      return apiFetch<T>(path, { ...options, _retried: true });
    }
  }

  let envelope: ApiEnvelope<T>;

  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Réponse illisible du serveur.",
    };
  }

  if (envelope.ok) return { ok: true, data: envelope.data };

  return {
    ok: false,
    code: envelope.error.code,
    message: envelope.error.message,
    fields: envelope.error.fields,
  };
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PUT", body }),
  delete: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "DELETE", body }),
};
