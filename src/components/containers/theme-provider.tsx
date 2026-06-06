import appStore from "@/stores/app-store";
import { DEFAULT_THEME, themes } from "@/app/themes";
import { useEffect } from "react";
import { useStore } from "zustand";

const ThemeProvider = () => {
  const theme = useStore(appStore, (i) => i.theme);

  useEffect(() => {
    // Guard against stale/removed themes persisted in localStorage (older
    // builds offered DaisyUI built-ins that don't define our --gw-* tokens
    // and rendered unreadable). Fall back to the default if invalid.
    const valid = (themes as readonly string[]).includes(theme);
    const applied = valid ? theme : DEFAULT_THEME;
    if (!valid) appStore.setTheme(DEFAULT_THEME);
    document.documentElement.setAttribute("data-theme", applied);
  }, [theme]);

  return null;
};

export default ThemeProvider;
