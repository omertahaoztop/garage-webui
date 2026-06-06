// Theme list shown in the sidebar dropdown.
// Only the two custom themes are offered: the rest of DaisyUI's built-ins do
// not define the --gw-* design tokens this UI relies on, so they rendered with
// unreadable (unset) foreground colors. Keep the palette to what we actually
// style.

export const themes = ["garage-dark", "garage-light"] as const;

export type Themes = (typeof themes)[number];

// Default theme on first load.
export const DEFAULT_THEME: Themes = "garage-dark";

// Friendly labels for the theme switcher dropdown.
export const THEME_LABELS: Record<Themes, string> = {
  "garage-dark": "Garage Dark",
  "garage-light": "Garage Light",
};
