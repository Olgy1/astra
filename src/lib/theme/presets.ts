import type { ThemeConfig } from "@/lib/schemas/theme";
import { defaultThemeConfig } from "@/lib/schemas/theme";

/**
 * Thèmes prédéfinis, appliqués en un clic.
 *
 * Chaque preset part du thème par défaut et n'écrase que ce qui fait son
 * identité : arrière-plan, couleurs de texte, carte, avatar. Les réglages que
 * l'utilisateur a déjà faits ailleurs (curseur, musique, écran d'entrée) ne
 * sont pas touchés — le preset est une base visuelle, pas un formatage.
 */
export type ThemePreset = {
  id: string;
  name: string;
  /** Deux couleurs représentatives, pour la pastille du sélecteur. */
  swatch: [string, string];
  apply: () => ThemeConfig;
};

function preset(overrides: Partial<ThemeConfig> & { background?: ThemeConfig["background"] }): ThemeConfig {
  return { ...defaultThemeConfig(), ...overrides };
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "neon",
    name: "Néon violet",
    swatch: ["#0a0a0f", "#8b5cf6"],
    apply: () =>
      preset({
        background: { kind: "solid", color: "#0a0a0f" },
        typography: {
          ...defaultThemeConfig().typography,
          textColor: "#ffffff",
          accentColor: "#8b5cf6",
          mutedColor: "#a1a1aa",
        },
        card: {
          ...defaultThemeConfig().card,
          backgroundColor: "#12121a",
          borderColor: "#2a2a35",
          glowEnabled: true,
          glowColor: "#8b5cf6",
        },
        avatar: { ...defaultThemeConfig().avatar, borderColor: "#8b5cf6", glowEnabled: true, glowColor: "#8b5cf6" },
      }),
  },
  {
    id: "midnight",
    name: "Minuit",
    swatch: ["#05070d", "#e4e4e7"],
    apply: () =>
      preset({
        background: { kind: "solid", color: "#05070d" },
        typography: {
          ...defaultThemeConfig().typography,
          textColor: "#fafafa",
          accentColor: "#e4e4e7",
          mutedColor: "#71717a",
        },
        card: {
          ...defaultThemeConfig().card,
          backgroundColor: "#0c0e14",
          borderColor: "#1f2430",
          blur: 20,
          glowEnabled: false,
        },
        avatar: { ...defaultThemeConfig().avatar, borderColor: "#e4e4e7", glowEnabled: false },
      }),
  },
  {
    id: "bubblegum",
    name: "Rose bonbon",
    swatch: ["#1c0a14", "#ff5fa2"],
    apply: () =>
      preset({
        background: { kind: "gradient", type: "linear", angle: 160, stops: [{ color: "#1c0a14", at: 0 }, { color: "#3a1030", at: 100 }] },
        typography: {
          ...defaultThemeConfig().typography,
          textColor: "#ffffff",
          accentColor: "#ff5fa2",
          mutedColor: "#d4a3bc",
        },
        card: {
          ...defaultThemeConfig().card,
          backgroundColor: "#241020",
          borderColor: "#4a2040",
          glowEnabled: true,
          glowColor: "#ff5fa2",
          animatedBorder: true,
          animatedBorderColor: "#ff5fa2",
        },
        avatar: { ...defaultThemeConfig().avatar, borderColor: "#ff5fa2", glowEnabled: true, glowColor: "#ff5fa2" },
        effects: { ...defaultThemeConfig().effects, titleAnimation: "sparkle" },
      }),
  },
  {
    id: "ocean",
    name: "Océan",
    swatch: ["#020d1a", "#22d3ee"],
    apply: () =>
      preset({
        background: { kind: "gradient", type: "radial", angle: 180, stops: [{ color: "#020d1a", at: 0 }, { color: "#0b2e4f", at: 100 }] },
        typography: {
          ...defaultThemeConfig().typography,
          textColor: "#f0f9ff",
          accentColor: "#22d3ee",
          mutedColor: "#93c5fd",
        },
        card: {
          ...defaultThemeConfig().card,
          backgroundColor: "#04182b",
          borderColor: "#155e75",
          glowEnabled: true,
          glowColor: "#22d3ee",
        },
        avatar: { ...defaultThemeConfig().avatar, borderColor: "#22d3ee", glowEnabled: true, glowColor: "#22d3ee" },
        effects: { ...defaultThemeConfig().effects, particles: { enabled: true, kind: "bubbles", color: "#22d3ee", count: 30, speed: 0.8 } },
      }),
  },
  {
    id: "paper",
    name: "Papier",
    swatch: ["#f5f0e8", "#111827"],
    apply: () =>
      preset({
        background: { kind: "solid", color: "#f5f0e8" },
        typography: {
          ...defaultThemeConfig().typography,
          textColor: "#1f2937",
          accentColor: "#7c3aed",
          mutedColor: "#6b7280",
          textGlow: false,
        },
        card: {
          ...defaultThemeConfig().card,
          backgroundColor: "#ffffff",
          opacity: 0.95,
          blur: 0,
          borderColor: "#e5e0d5",
          shadowSize: 12,
          glowEnabled: false,
        },
        avatar: { ...defaultThemeConfig().avatar, borderColor: "#7c3aed", glowEnabled: false },
      }),
  },
  {
    id: "neon-green",
    name: "Vert fluo",
    swatch: ["#060a06", "#a3e635"],
    apply: () =>
      preset({
        background: { kind: "solid", color: "#060a06" },
        typography: {
          ...defaultThemeConfig().typography,
          textColor: "#f7fee7",
          accentColor: "#a3e635",
          mutedColor: "#9ca3af",
        },
        card: {
          ...defaultThemeConfig().card,
          backgroundColor: "#0c1208",
          borderColor: "#365314",
          glowEnabled: true,
          glowColor: "#a3e635",
          animatedBorder: true,
          animatedBorderColor: "#a3e635",
        },
        avatar: { ...defaultThemeConfig().avatar, borderColor: "#a3e635", glowEnabled: true, glowColor: "#a3e635" },
        effects: { ...defaultThemeConfig().effects, titleAnimation: "glitch" },
      }),
  },
];
