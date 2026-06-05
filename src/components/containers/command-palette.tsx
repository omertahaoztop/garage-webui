import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArchiveIcon,
  HardDrive,
  KeySquare,
  LayoutDashboard,
  LogOut,
  Palette,
  Search,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import appStore from "@/stores/app-store";
import { THEME_LABELS, themes, type Themes } from "@/app/themes";
import { cn } from "@/lib/utils";

type CmdItem = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ReactNode;
  perform: () => void;
};

type CmdPage = "root" | "theme";

/**
 * CommandPalette — Vercel-style paged ⌘K overlay.
 *
 * Architecture:
 *  - Single mount in MainLayout (always present, conditional render on `open`).
 *  - Global keyboard listener for ⌘K / Ctrl+K toggle + ESC close + arrows.
 *  - Items are pure data; performing one closes the palette (unless it pages).
 *  - `page` state allows nested screens (currently only `theme`); Backspace on
 *    empty query pops back to root.
 *
 * Design tokens (b69) drive all visual choices:
 *  - surface-1 background, hairline border, gw-floating shadow.
 *  - 48 px row height, 14 px body, 12 px caption hint, monospace `kbd` chips.
 *  - 150 ms scale(0.96) → scale(1) entrance bounce via CSS keyframe in styles.css.
 */
const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<CmdPage>("root");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const auth = useAuth();
  // Non-reactive read: palette state resets every open() so a fresh getState() captures the current theme.
  const theme = appStore.getState().theme;

  // Global ⌘K / Ctrl+K toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Reset focus + query when opening.
  useEffect(() => {
    if (open) {
      setPage("root");
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const close = () => setOpen(false);

  const items: CmdItem[] = useMemo(() => {
    if (page === "theme") {
      return themes.map((t) => ({
        id: `theme:${t}`,
        label: THEME_LABELS[t] ?? t,
        hint: t === theme ? "current" : undefined,
        group: "Themes",
        icon: <Palette size={16} />,
        perform: () => {
          appStore.setTheme(t);
          close();
        },
      }));
    }

    const list: CmdItem[] = [
      {
        id: "nav:dashboard",
        label: "Dashboard",
        group: "Navigate",
        icon: <LayoutDashboard size={16} />,
        perform: () => {
          navigate("/");
          close();
        },
      },
      {
        id: "nav:buckets",
        label: "Browse Buckets",
        group: "Navigate",
        icon: <ArchiveIcon size={16} />,
        perform: () => {
          navigate("/buckets");
          close();
        },
      },
      {
        id: "nav:keys",
        label: "Access Keys",
        group: "Navigate",
        icon: <KeySquare size={16} />,
        perform: () => {
          navigate("/keys");
          close();
        },
      },
    ];

    if (auth.isAdmin) {
      list.push({
        id: "nav:cluster",
        label: "Cluster Admin",
        group: "Navigate",
        icon: <HardDrive size={16} />,
        perform: () => {
          navigate("/cluster");
          close();
        },
      });
    }

    list.push({
      id: "page:theme",
      label: "Change theme…",
      hint: THEME_LABELS[theme as Themes] ?? theme,
      group: "Preferences",
      icon: <Palette size={16} />,
      perform: () => {
        setPage("theme");
        setQuery("");
        setActive(0);
      },
    });

    if (auth.isEnabled) {
      list.push({
        id: "action:logout",
        label: "Sign out",
        group: "Account",
        icon: <LogOut size={16} />,
        perform: () => {
          // Fire-and-forget; MainLayout will redirect on auth gate.
          fetch("/api/auth/logout", { method: "POST", credentials: "include" }).finally(() => {
            window.location.href = "/auth/login";
          });
        },
      });
    }

    return list;
  }, [page, theme, auth.isAdmin, auth.isEnabled, navigate]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, query]);

  // Group flat items into [groupName, items[]] tuples preserving order.
  const grouped = useMemo(() => {
    const map = new Map<string, CmdItem[]>();
    for (const it of filtered) {
      const g = it.group || "Other";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(it);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // Reset active index when filter shrinks.
  useEffect(() => {
    if (active >= filtered.length) setActive(0);
  }, [filtered.length, active]);

  // Arrow / Enter / Backspace handling while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        filtered[active]?.perform();
      } else if (e.key === "Backspace" && !query && page !== "root") {
        e.preventDefault();
        setPage("root");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, active, query, page]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
      onClick={close}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" aria-hidden />
      <div
        className="cmdk-root relative w-full max-w-[600px] mx-4 bg-base-100 rounded-gw-lg border border-hairline shadow-gw-floating overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 h-14 border-b border-hairline">
          <Search size={18} className="text-fg-muted" />
          <input
            ref={inputRef}
            className="bg-transparent flex-1 outline-none text-body placeholder:text-fg-muted"
            placeholder={
              page === "theme" ? "Search themes…" : "Type a command or search…"
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
          />
          <kbd className="text-caption text-fg-muted px-1.5 py-0.5 border border-hairline rounded-gw-xs">
            ESC
          </kbd>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-2">
          {grouped.length === 0 ? (
            <div className="px-3 py-10 text-center text-fg-muted text-body-sm">
              No results
            </div>
          ) : (
            grouped.map(([group, list]) => (
              <div key={group} className="mb-1">
                <div className="px-3 pt-2 pb-1 text-caption text-fg-muted uppercase tracking-wider">
                  {group}
                </div>
                {list.map((it) => {
                  const globalIdx = filtered.indexOf(it);
                  const isActive = globalIdx === active;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onMouseEnter={() => setActive(globalIdx)}
                      onClick={(e) => {
                        e.stopPropagation();
                        it.perform();
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 h-12 rounded-gw-sm text-left text-body transition-colors duration-100 ease-gw",
                        isActive
                          ? "bg-base-200 text-fg-primary"
                          : "text-fg-secondary hover:bg-base-200 hover:text-fg-primary"
                      )}
                    >
                      <span className="text-fg-secondary">{it.icon}</span>
                      <span className="flex-1 truncate">{it.label}</span>
                      {it.hint && (
                        <span className="text-caption text-fg-muted truncate max-w-[180px]">
                          {it.hint}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-hairline px-3 h-9 flex items-center gap-4 text-caption text-fg-muted">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 border border-hairline rounded-gw-xs">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 border border-hairline rounded-gw-xs">↵</kbd>
            select
          </span>
          {page !== "root" && (
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 border border-hairline rounded-gw-xs">⌫</kbd>
              back
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 border border-hairline rounded-gw-xs">⌘ K</kbd>
            anywhere
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
