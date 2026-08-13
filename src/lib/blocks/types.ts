import type { ZodType, ZodTypeDef } from "zod";

/**
 * Contrat d'un type de block.
 *
 * Un block est décrit une seule fois, ici, et cette description sert à trois
 * consommateurs : l'API (validation du config à l'écriture), l'éditeur
 * (rendu du formulaire, libellés, catégorie) et la page publique (rendu).
 *
 * Conséquence recherchée : ajouter un widget = créer un fichier dans
 * `definitions/`, le référencer dans `registry.ts`, écrire son composant de
 * rendu. Aucune migration, aucun `switch` à retrouver dans le code.
 */

export type BlockCategory = "identity" | "links" | "embeds" | "widgets";

export type BlockDefinition<TConfig = unknown> = {
  /** Clé stockée dans `blocks.type`. Immuable une fois en production. */
  type: string;

  label: string;
  description: string;
  /** Identifiant d'icône résolu par l'éditeur. */
  icon: string;
  category: BlockCategory;

  /**
   * Valide et normalise `blocks.config`. Doit tolérer `{}` en entrée.
   *
   * Le type d'entrée est `unknown`, et non `TConfig` : avec des champs en
   * `.default()`, ce qu'on accepte en entrée (tout optionnel) et ce qu'on
   * produit en sortie (tout rempli) sont deux types différents. `ZodSchema<T>`
   * les force à être égaux et rejetterait toute définition à défauts.
   */
  configSchema: ZodType<TConfig, ZodTypeDef, unknown>;

  /**
   * Nombre maximum d'instances par biolink.
   * `null` = illimité. Un avatar ou un header n'a de sens qu'une fois ;
   * des liens ou des embeds, non.
   */
  maxPerBiolink: number | null;

  /** Réservé aux admins (blocks de démo, widgets internes). */
  adminOnly?: boolean;

  /**
   * Le block dépend d'un service externe et peut échouer à l'affichage.
   * Le renderer l'enveloppe alors dans une frontière d'erreur (étape 4).
   */
  externalDependency?: boolean;
};

/**
 * Définition dont le type de config est effacé.
 *
 * Le registry est une collection hétérogène : chaque entrée a son propre
 * TConfig, et TypeScript n'a pas de types existentiels pour exprimer « une
 * définition, quel que soit son config ». `any` est ici l'échappatoire
 * habituelle. Elle est sans danger en pratique : `validateBlockConfig` ne
 * renvoie jamais le config typé, il renvoie `unknown`, et le consommateur
 * repasse par le schéma pour le typer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyBlockDefinition = BlockDefinition<any>;

/** Config par défaut d'une définition, dérivée de son schéma. */
export function defaultConfigFor(definition: AnyBlockDefinition): unknown {
  const parsed = definition.configSchema.safeParse({});

  if (!parsed.success) {
    // Un schéma dont tous les champs n'ont pas de défaut est un bug de
    // définition : l'éditeur ne pourrait pas insérer le block.
    throw new Error(
      `Le block « ${definition.type} » n'a pas de config par défaut valide. ` +
        `Chaque champ de son configSchema doit avoir un .default().`
    );
  }

  return parsed.data;
}
