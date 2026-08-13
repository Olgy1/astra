import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

/**
 * Contrat de réponse des route handlers.
 *
 * Toutes les réponses ont la même forme : `{ ok: true, data }` ou
 * `{ ok: false, error: { code, message, fields? } }`. Le front peut donc
 * discriminer sur `ok` sans deviner la forme selon le status HTTP.
 */

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "EMAIL_NOT_VERIFIED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "QUOTA_EXCEEDED"
  | "RATE_LIMITED"
  | "CAPTCHA_REQUIRED"
  | "TWO_FACTOR_REQUIRED"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_BANNED"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  EMAIL_NOT_VERIFIED: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  QUOTA_EXCEEDED: 403,
  RATE_LIMITED: 429,
  CAPTCHA_REQUIRED: 403,
  TWO_FACTOR_REQUIRED: 401,
  ACCOUNT_SUSPENDED: 403,
  ACCOUNT_BANNED: 403,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL_ERROR: 500,
};

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    /** Erreurs par champ, pour l'affichage sous les inputs. */
    fields?: Record<string, string[]>;
  };
};

export function ok<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true as const, data }, { status });
}

export function fail(
  code: ApiErrorCode,
  message: string,
  options?: { fields?: Record<string, string[]>; headers?: HeadersInit }
): NextResponse<ApiFailure> {
  return NextResponse.json(
    { ok: false as const, error: { code, message, fields: options?.fields } },
    { status: STATUS_BY_CODE[code], headers: options?.headers }
  );
}

/**
 * Erreur métier lançable depuis n'importe quelle couche. `withErrorHandling`
 * la convertit en réponse ; toute autre exception devient un 500 opaque.
 */
export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly fields?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Aplatit une ZodError en `{ champ: [messages] }`. */
export function zodFields(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    (fields[path] ??= []).push(issue.message);
  }

  return fields;
}

/**
 * Parse et valide le body JSON d'une requête.
 * Lance une ApiError plutôt que de retourner un Result : les handlers
 * restent linéaires, `withErrorHandling` s'occupe de la conversion.
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<T> {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    throw new ApiError("BAD_REQUEST", "Corps de requête JSON invalide.");
  }

  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Certains champs sont invalides.",
      zodFields(parsed.error)
    );
  }

  return parsed.data;
}

/** Valide les query params d'une URL avec un schéma zod. */
export function parseQuery<T>(request: Request, schema: ZodSchema<T>): T {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = schema.safeParse(params);

  if (!parsed.success) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Paramètres de requête invalides.",
      zodFields(parsed.error)
    );
  }

  return parsed.data;
}

/**
 * Enveloppe un handler : convertit ApiError et ZodError en réponses propres,
 * et empêche toute autre exception de fuiter un message interne (chemin de
 * fichier, requête SQL, identifiant) vers le client.
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return fail(error.code, error.message, { fields: error.fields });
      }

      if (error instanceof ZodError) {
        return fail("VALIDATION_ERROR", "Certains champs sont invalides.", {
          fields: zodFields(error),
        });
      }

      console.error("[api] exception non gérée :", error);

      return fail(
        "INTERNAL_ERROR",
        "Une erreur interne est survenue. Réessayez dans un instant."
      );
    }
  };
}

/**
 * IP du client. Derrière un proxy (Vercel, nginx, Cloudflare), l'IP de la
 * socket est celle du proxy ; la vraie IP est dans les en-têtes.
 *
 * Ces en-têtes sont falsifiables si l'app est exposée en direct. Ils ne
 * doivent donc servir qu'au rate limiting et aux logs, jamais à une décision
 * d'autorisation.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Format : "client, proxy1, proxy2" — le premier est l'origine.
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return request.headers.get("x-real-ip") ?? "0.0.0.0";
}
