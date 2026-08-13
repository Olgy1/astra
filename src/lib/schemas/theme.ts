import { z } from "zod";

/**
 * Forme de `Biolink.themeConfig`.
 *
 * La colonne est un JSONB libre côté Postgres ; c'est ce schéma qui fait
 * autorité. Ajouter une option de personnalisation = ajouter un champ ici,
 * avec un `.default()`. Les lignes existantes ne sont pas migrées : elles
 * n'ont simplement pas la clé, et le parse la remplit à la lecture.
 *
 * Corollaire à respecter : tout nouveau champ doit avoir un défaut. Un champ
 * requis ajouté après coup ferait échouer le parse de toutes les lignes
 * antérieures.
 */

/** Couleur hex #rgb, #rrggbb ou #rrggbbaa. */
const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "Couleur hexadécimale invalide.");

/**
 * URL de média. Restreinte à http(s) : `javascript:` et `data:` dans un
 * `background-image` ou un `src` sont des vecteurs XSS classiques.
 */
const mediaUrl = z
  .string()
  .url("URL invalide.")
  .refine(
    (value) => value.startsWith("https://") || value.startsWith("http://"),
    "Seules les URL http(s) sont acceptées."
  );

export const backgroundSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("solid"),
    color: hexColor.default("#0a0a0f"),
  }),
  z.object({
    kind: z.literal("gradient"),
    // Deux arrêts minimum, huit maximum : au-delà, l'utilisateur construit
    // un dégradé illisible et la chaîne CSS devient énorme.
    stops: z
      .array(z.object({ color: hexColor, at: z.number().min(0).max(100) }))
      .min(2, "Un dégradé demande au moins deux couleurs.")
      .max(8, "Huit couleurs maximum dans un dégradé."),
    angle: z.number().min(0).max(360).default(180),
    type: z.enum(["linear", "radial", "conic"]).default("linear"),
  }),
  z.object({
    kind: z.literal("image"),
    url: mediaUrl,
    fit: z.enum(["cover", "contain", "tile"]).default("cover"),
    blur: z.number().min(0).max(40).default(0),
    // Assombrit l'image pour garder le texte lisible par-dessus.
    dim: z.number().min(0).max(1).default(0.3),
  }),
  z.object({
    kind: z.literal("video"),
    url: mediaUrl,
    blur: z.number().min(0).max(40).default(0),
    dim: z.number().min(0).max(1).default(0.4),
    muted: z.boolean().default(true),
    /**
     * Utiliser la piste audio de la vidéo comme son de la page.
     *
     * Quand actif, la vidéo n'est plus muette et fournit la musique — c'est
     * ce que l'utilisateur attend d'un fond vidéo « avec le son ». Comme tout
     * autoplay sonore, ça reste bloqué par le navigateur tant que le visiteur
     * n'a pas interagi : le renderer affiche donc l'écran d'entrée.
     */
    useVideoAudio: z.boolean().default(false),
    volume: z.number().min(0).max(1).default(0.5),
  }),
]);

export type Background = z.infer<typeof backgroundSchema>;

export const typographySchema = z.object({
  /** Nom d'une police du catalogue, ou "custom" si `customFontUrl` est posé. */
  fontFamily: z.string().max(64).default("Inter"),
  customFontUrl: mediaUrl.optional(),
  textColor: hexColor.default("#ffffff"),
  accentColor: hexColor.default("#8b5cf6"),
  mutedColor: hexColor.default("#a1a1aa"),
  fontSize: z.number().min(12).max(24).default(16),
  letterSpacing: z.number().min(-2).max(8).default(0),
  /** Halo lumineux sous tout le texte (esthétique néon, très présente ici). */
  textGlow: z.boolean().default(false),
  textGlowColor: hexColor.default("#8b5cf6"),
  textGlowIntensity: z.number().min(0).max(30).default(12),
  /** Rend le pseudo/titre en dégradé texte → accent, animé en boucle. */
  titleGradient: z.boolean().default(false),
});

export const cardSchema = z.object({
  backgroundColor: hexColor.default("#12121a"),
  opacity: z.number().min(0).max(1).default(0.85),
  blur: z.number().min(0).max(40).default(12),
  borderRadius: z.number().min(0).max(48).default(16),
  borderWidth: z.number().min(0).max(8).default(1),
  borderColor: hexColor.default("#27272a"),
  shadowSize: z.number().min(0).max(64).default(24),
  shadowColor: hexColor.default("#00000080"),
  /** Lueur colorée derrière la carte, très présente sur ce type de page. */
  glowEnabled: z.boolean().default(false),
  glowColor: hexColor.default("#8b5cf6"),
  /** Bordure animée qui tourne autour de la carte (« border beam »). */
  animatedBorder: z.boolean().default(false),
  animatedBorderColor: hexColor.default("#8b5cf6"),
});

export const avatarSchema = z.object({
  shape: z.enum(["circle", "square", "rounded"]).default("circle"),
  size: z.number().min(48).max(200).default(96),
  borderWidth: z.number().min(0).max(8).default(2),
  borderColor: hexColor.default("#8b5cf6"),
  glowEnabled: z.boolean().default(false),
  glowColor: hexColor.default("#8b5cf6"),
  /** Priorité à l'avatar du compte Discord lié, même si un avatar est uploadé. */
  useDiscord: z.boolean().default(false),
});

/**
 * Bannière : image horizontale en tête de carte. Indépendante de
 * l'arrière-plan (qui, lui, couvre toute la page).
 */
export const bannerSchema = z.object({
  url: mediaUrl.optional(),
  height: z.number().min(40).max(400).default(160),
});

export const effectsSchema = z.object({
  /** Effet 3D au survol de la carte. */
  tiltEnabled: z.boolean().default(false),
  tiltIntensity: z.number().min(1).max(25).default(10),

  particles: z
    .object({
      enabled: z.boolean().default(false),
      kind: z.enum(["snow", "stars", "bubbles", "confetti", "rain"]).default("stars"),
      color: hexColor.default("#ffffff"),
      // Plafonné à 200 : chaque particule est un nœud animé, au-delà on fait
      // fondre les téléphones bas de gamme — qui sont la majorité du trafic.
      count: z.number().min(5).max(200).default(50),
      speed: z.number().min(0.1).max(5).default(1),
    })
    .default({}),

  titleAnimation: z
    .enum(["none", "typewriter", "glitch", "fade", "sparkle", "wave"])
    .default("none"),
  /** Vitesse de l'animation de titre, en millisecondes par caractère. */
  titleAnimationSpeed: z.number().min(20).max(500).default(80),

  /** Fondu d'entrée global de la page. */
  entranceAnimation: z.enum(["none", "fade", "slide-up", "zoom"]).default("fade"),

  /**
   * Animation du titre de l'onglet (document.title), en machine à écrire.
   * Distincte de `titleAnimation`, qui anime le titre à l'intérieur de la
   * page : l'onglet est un endroit à part, animer les deux en même temps
   * n'aurait aucun sens.
   */
  tabTitleTypewriter: z.boolean().default(false),
  /** Vitesse de l'animation de l'onglet, en millisecondes par caractère. */
  tabTitleSpeed: z.number().min(20).max(300).default(80),
});

export const cursorSchema = z.object({
  enabled: z.boolean().default(false),
  /** URL d'une image uploadée (type CURSOR). */
  url: mediaUrl.optional(),
  /** Point actif du curseur, en pixels depuis le coin haut-gauche. */
  hotspotX: z.number().min(0).max(64).default(0),
  hotspotY: z.number().min(0).max(64).default(0),
  /** Traînée de particules suivant le curseur. */
  trailEnabled: z.boolean().default(false),
  trailColor: hexColor.default("#8b5cf6"),
  /** Forme des particules de la traînée. */
  trailKind: z.enum(["circles", "stars", "squares", "astra"]).default("circles"),
});

export const audioSchema = z.object({
  enabled: z.boolean().default(false),
  url: mediaUrl.optional(),
  volume: z.number().min(0).max(1).default(0.5),
  loop: z.boolean().default(true),
  /**
   * "autoplay" est une intention, pas une garantie : tous les navigateurs
   * bloquent la lecture audio non muette avant une interaction. Le renderer
   * affiche donc systématiquement un écran d'entrée cliquable quand l'audio
   * est activé (voir étape 4).
   */
  trigger: z.enum(["autoplay", "click"]).default("click"),
});

export const entranceScreenSchema = z.object({
  enabled: z.boolean().default(false),
  text: z.string().max(60).default("cliquez pour entrer"),
  blurAmount: z.number().min(0).max(40).default(12),
  /** Police du texte. Indépendante de la police globale de la page. */
  fontFamily: z.string().max(64).default("Inter"),
});

export const themeConfigSchema = z.object({
  /** Version du format, pour d'éventuelles conversions futures. */
  version: z.literal(1).default(1),
  background: backgroundSchema.default({ kind: "solid", color: "#0a0a0f" }),
  typography: typographySchema.default({}),
  card: cardSchema.default({}),
  avatar: avatarSchema.default({}),
  /** Bannière en haut de la carte. */
  banner: bannerSchema.default({}),
  effects: effectsSchema.default({}),
  cursor: cursorSchema.default({}),
  audio: audioSchema.default({}),
  entranceScreen: entranceScreenSchema.default({}),
  /** Layout général de la page. */
  layout: z
    .object({
      maxWidth: z.number().min(320).max(768).default(480),
      align: z.enum(["center", "left"]).default("center"),
      spacing: z.number().min(4).max(32).default(12),
    })
    .default({}),
});

export type ThemeConfig = z.infer<typeof themeConfigSchema>;

/**
 * Thème par défaut d'un nouveau biolink. Dérivé du schéma lui-même : les
 * défauts ne sont écrits qu'à un seul endroit.
 */
export function defaultThemeConfig(): ThemeConfig {
  return themeConfigSchema.parse({});
}

/**
 * Parse un themeConfig venu de la base.
 *
 * Tolérant par conception : si une ligne contient une valeur devenue
 * invalide (option retirée, format changé), on retombe sur le thème par
 * défaut plutôt que de renvoyer une 500. Une page moche vaut mieux qu'une
 * page morte.
 */
export function parseThemeConfig(raw: unknown): ThemeConfig {
  const parsed = themeConfigSchema.safeParse(raw ?? {});

  if (!parsed.success) {
    console.warn("[theme] config invalide, retour au thème par défaut :", parsed.error.issues);
    return defaultThemeConfig();
  }

  return parsed.data;
}
