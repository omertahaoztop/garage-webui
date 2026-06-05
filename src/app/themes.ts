// Theme list shown in the sidebar dropdown.
// First two are custom (Garage Dark/Light, Linear+Vercel hybrid).
// Rest are DaisyUI built-ins kept for legacy users — can be trimmed later.

export const themes = [
  "garage-dark",
  "garage-light",
  "dark",
  "dracula",
  "night",
  "corporate",
  "winter",
  "pastel",
  "cupcake",
  "dim",
  "nord",
  "valentine",
] as const;

export type Themes = (typeof themes)[number];

// Default theme on first load.
export const DEFAULT_THEME: Themes = "garage-dark";

// Friendly labels for the theme switcher dropdown.
export const THEME_LABELS: Record<Themes, string> = {
  "garage-dark": "Garage Dark",
  "garage-light": "Garage Light",
  dark: "Dark",
  dracula: "Dracula",
  night: "Night",
  corporate: "Corporate",
  winter: "Winter",
  pastel: "Pastel",
  cupcake: "Cupcake",
  dim: "Dim",
  nord: "Nord",
  valentine: "Valentine",
};
