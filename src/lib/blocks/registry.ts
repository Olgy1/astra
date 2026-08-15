import { ApiError } from "@/lib/api";
import type { AnyBlockDefinition, BlockCategory } from "@/lib/blocks/types";
import { defaultConfigFor } from "@/lib/blocks/types";

import { avatarBlock } from "@/lib/blocks/definitions/avatar";
import { countdownBlock } from "@/lib/blocks/definitions/countdown";
import { ctaButtonBlock } from "@/lib/blocks/definitions/cta-button";
import { discordServerBlock } from "@/lib/blocks/definitions/discord-server";
import { dividerBlock } from "@/lib/blocks/definitions/divider";
import { headerBlock } from "@/lib/blocks/definitions/header";
import { imageBlock } from "@/lib/blocks/definitions/image";
import { linksBlock } from "@/lib/blocks/definitions/links";
import { redditBlock } from "@/lib/blocks/definitions/reddit";
import { socialsBlock } from "@/lib/blocks/definitions/socials";
import { spotifyBlock } from "@/lib/blocks/definitions/spotify";
import { textBlock } from "@/lib/blocks/definitions/text";
import { videoBlock } from "@/lib/blocks/definitions/video";

/**
 * Registry des types de blocks.
 *
 * Point d'extension unique de la plateforme. Ajouter un widget :
 *   1. créer `definitions/mon-widget.ts` (schéma zod + métadonnées) ;
 *   2. l'importer et l'ajouter au tableau ci-dessous ;
 *   3. écrire son composant de rendu et l'enregistrer dans le renderer
 *      (`components/blocks/renderer.tsx`, étape 4).
 *
 * Pas de migration : `blocks.type` est un VARCHAR et `blocks.config` un
 * JSONB. C'est ce fichier, et non la base, qui définit ce qui est valide.
 */
// Les blocks « badges » et « visit_counter » ont été retirés du catalogue :
// les badges ne sont plus affichés sur les pages publiques, et le compteur
// de vues vit désormais dans les coins de la carte (thème → Compteur de
// vues). Les types restent validés pour les anciennes pages (elles sont
// simplement rendues vides par le renderer).
const DEFINITIONS: readonly AnyBlockDefinition[] = [
  // identity
  avatarBlock,
  headerBlock,
  textBlock,
  imageBlock,
  dividerBlock,
  // links
  linksBlock,
  socialsBlock,
  ctaButtonBlock,
  // embeds
  videoBlock,
  spotifyBlock,
  redditBlock,
  discordServerBlock,
  // widgets
  countdownBlock,
];

const REGISTRY = new Map<string, AnyBlockDefinition>(
  DEFINITIONS.map((definition) => [definition.type, definition])
);

// Deux définitions partageant une clé se masqueraient silencieusement dans la
// Map, et les blocks déjà en base seraient validés par le mauvais schéma. On
// préfère refuser de démarrer.
if (REGISTRY.size !== DEFINITIONS.length) {
  const seen = new Set<string>();
  const duplicates = DEFINITIONS.map((d) => d.type).filter((type) => {
    if (seen.has(type)) return true;
    seen.add(type);
    return false;
  });
  throw new Error(
    `Types de blocks dupliqués dans le registry : ${duplicates.join(", ")}`
  );
}

export function getBlockDefinition(type: string): AnyBlockDefinition | undefined {
  return REGISTRY.get(type);
}

export function listBlockDefinitions(): readonly AnyBlockDefinition[] {
  return DEFINITIONS;
}

export function listBlockTypes(): string[] {
  return DEFINITIONS.map((definition) => definition.type);
}

/** Définitions groupées par catégorie, pour le sélecteur de l'éditeur. */
export function blocksByCategory(): Record<BlockCategory, AnyBlockDefinition[]> {
  const grouped: Record<BlockCategory, AnyBlockDefinition[]> = {
    identity: [],
    links: [],
    embeds: [],
    widgets: [],
  };

  for (const definition of DEFINITIONS) {
    grouped[definition.category].push(definition);
  }

  return grouped;
}

/**
 * Métadonnées exposables au client. Les schémas zod ne sont pas
 * sérialisables et n'ont rien à faire dans le bundle : l'éditeur reçoit les
 * libellés et les contraintes, la validation qui fait foi reste serveur.
 */
export type PublicBlockMeta = {
  type: string;
  label: string;
  description: string;
  icon: string;
  category: BlockCategory;
  maxPerBiolink: number | null;
  adminOnly: boolean;
};

export function publicBlockCatalog(isAdmin: boolean): PublicBlockMeta[] {
  return DEFINITIONS.filter((definition) => isAdmin || !definition.adminOnly).map(
    (definition) => ({
      type: definition.type,
      label: definition.label,
      description: definition.description,
      icon: definition.icon,
      category: definition.category,
      maxPerBiolink: definition.maxPerBiolink,
      adminOnly: definition.adminOnly ?? false,
    })
  );
}

/**
 * Valide le config d'un block contre le schéma de son type.
 *
 * Appelé à chaque écriture. Sans ça, `blocks.config` étant un JSONB libre,
 * n'importe quel JSON passerait — y compris une URL `javascript:` dans un
 * champ qui finit en attribut `href`.
 */
export function validateBlockConfig(type: string, config: unknown): unknown {
  const definition = getBlockDefinition(type);

  if (!definition) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `Type de block inconnu : « ${type} ».`,
      { type: [`Types acceptés : ${listBlockTypes().join(", ")}`] }
    );
  }

  const parsed = definition.configSchema.safeParse(config ?? {});

  if (!parsed.success) {
    const fields: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = `config.${issue.path.join(".")}`;
      (fields[path] ??= []).push(issue.message);
    }

    throw new ApiError(
      "VALIDATION_ERROR",
      `Configuration invalide pour le block « ${definition.label} ».`,
      fields
    );
  }

  return parsed.data;
}

/** Config par défaut d'un type, pour l'insertion depuis l'éditeur. */
export function defaultBlockConfig(type: string): unknown {
  const definition = getBlockDefinition(type);

  if (!definition) {
    throw new ApiError("VALIDATION_ERROR", `Type de block inconnu : « ${type} ».`);
  }

  return defaultConfigFor(definition);
}

/**
 * Vérifie qu'un type n'est pas réservé aux admins.
 * `role` vient du token vérifié côté serveur, jamais du client.
 */
export function assertBlockAllowed(type: string, isAdmin: boolean): void {
  const definition = getBlockDefinition(type);

  if (!definition) {
    throw new ApiError("VALIDATION_ERROR", `Type de block inconnu : « ${type} ».`);
  }

  if (definition.adminOnly && !isAdmin) {
    throw new ApiError(
      "FORBIDDEN",
      `Le block « ${definition.label} » est réservé aux administrateurs.`
    );
  }
}

/**
 * Vérifie la limite d'instances par biolink.
 * `currentCount` doit être compté dans la même transaction que l'insertion,
 * sinon deux ajouts simultanés peuvent tous deux passer le contrôle.
 */
export function assertUnderInstanceLimit(type: string, currentCount: number): void {
  const definition = getBlockDefinition(type);

  if (!definition) {
    throw new ApiError("VALIDATION_ERROR", `Type de block inconnu : « ${type} ».`);
  }

  if (definition.maxPerBiolink !== null && currentCount >= definition.maxPerBiolink) {
    throw new ApiError(
      "CONFLICT",
      definition.maxPerBiolink === 1
        ? `Vous avez déjà un block « ${definition.label} » sur cette page.`
        : `Vous avez atteint la limite de ${definition.maxPerBiolink} blocks « ${definition.label} ».`
    );
  }
}
