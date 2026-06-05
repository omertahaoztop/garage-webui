import { cn } from "@/lib/utils";
import {
  ArchiveIcon,
  Boxes,
  ChevronsLeft,
  ChevronsRight,
  Cpu,
  HardDrive,
  KeySquare,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Network,
  Palette,
} from "lucide-react";
import { Dropdown } from "react-daisyui";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { useStore } from "zustand";
import { THEME_LABELS, themes } from "@/app/themes";
import appStore from "@/stores/app-store";
import { useMutation } from "@tanstack/react-query";
import api from "@/lib/api";
import * as utils from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import ClusterSwitcher from "./cluster-switcher";

// Inverted-L navigation (Linear style):
//   Sidebar (240px / 64px collapsed) + Header (56px) form an L.
//   - Indigo accent only on the ACTIVE menu item background tint.
//   - Brand monogram replaces the decorative logo block.
//   - Bottom controls (Theme / Sign out / Collapse) share one column.
//   - Mobile: react-daisyui Drawer overlay opens the sidebar at full width.

const allPages = [
  { icon: LayoutDashboard, title: "Dashboard", path: "/", exact: true, adminOnly: false },
  { icon: HardDrive, title: "Cluster", path: "/cluster", exact: true, adminOnly: true },
  { icon: Network, title: "Layout", path: "/cluster/layout", adminOnly: true },
  { icon: Cpu, title: "Workers", path: "/workers", adminOnly: true },
  { icon: Boxes, title: "Block Errors", path: "/blocks", adminOnly: true },
  { icon: ArchiveIcon, title: "Buckets", path: "/buckets", adminOnly: false },
  { icon: KeySquare, title: "Keys", path: "/keys", adminOnly: true },
  { icon: KeyRound, title: "Admin Tokens", path: "/admin-tokens", adminOnly: true },
];

const Sidebar = () => {
  const { pathname } = useLocation();
  const auth = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const theme = useStore(appStore, (s) => s.theme);
  const pages = allPages.filter((p) => !p.adminOnly || auth.isAdmin);

  return (
    <aside
      className={cn(
        "bg-base-100 border-r border-hairline flex flex-col h-full overflow-hidden transition-[width] duration-150 ease-gw",
        collapsed ? "w-[64px]" : "w-full md:w-[240px]"
      )}
    >
      {/* Brand block */}
      <div
        className={cn(
          "flex items-center gap-2.5 h-[57px] border-b border-hairline shrink-0",
          collapsed ? "justify-center px-0" : "px-4"
        )}
      >
        <div className="w-7 h-7 rounded-gw-md bg-primary text-primary-content flex items-center justify-center font-semibold text-[14px] tracking-tight shrink-0">
          G
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold leading-tight text-fg-primary">
              Garage
            </p>
            <p className="text-[11px] text-fg-muted leading-tight">
              Storage Console
            </p>
          </div>
        )}
      </div>

      {/* Cluster switcher — full-width row, hidden when collapsed */}
      {!collapsed && (
        <div className="px-3 py-2 border-b border-hairline shrink-0">
          <ClusterSwitcher />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        <ul className="space-y-0.5">
          {pages.map((p) => {
            const isActive = p.exact ? pathname === p.path : pathname.startsWith(p.path);
            const Icon = p.icon;
            return (
              <li key={p.path}>
                <Link
                  to={p.path}
                  className={cn(
                    "flex items-center gap-2.5 h-8 rounded-gw-sm text-body-sm font-medium transition-colors duration-100 ease-gw",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-fg-secondary hover:bg-base-200 hover:text-fg-primary",
                    collapsed ? "justify-center px-0" : "px-2.5"
                  )}
                  title={collapsed ? p.title : undefined}
                >
                  <Icon size={16} strokeWidth={1.75} />
                  {!collapsed && <span>{p.title}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom controls */}
      <div className="border-t border-hairline px-2 py-2 space-y-0.5 shrink-0">
        <Dropdown vertical="top">
          <Dropdown.Toggle
            button={false}
            className={cn(
              "flex items-center gap-2.5 h-8 rounded-gw-sm text-body-sm font-medium text-fg-secondary hover:bg-base-200 hover:text-fg-primary cursor-pointer w-full transition-colors duration-100 ease-gw",
              collapsed ? "justify-center px-0" : "px-2.5"
            )}
          >
            <Palette size={16} strokeWidth={1.75} />
            {!collapsed && <span>Theme</span>}
          </Dropdown.Toggle>
          <Dropdown.Menu className="w-44 max-h-72 overflow-y-auto p-1">
            {themes.map((t) => (
              <Dropdown.Item
                key={t}
                onClick={() => appStore.setTheme(t)}
                className={cn(
                  "text-body-sm rounded-gw-xs",
                  theme === t && "text-primary font-medium"
                )}
              >
                {THEME_LABELS[t] || t}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>

        {auth.isEnabled && <LogoutButton collapsed={collapsed} />}

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "hidden md:flex items-center gap-2.5 h-8 rounded-gw-sm text-body-sm font-medium text-fg-muted hover:bg-base-200 hover:text-fg-primary w-full transition-colors duration-100 ease-gw",
            collapsed ? "justify-center px-0" : "px-2.5"
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
};

type LogoutBtnProps = { collapsed: boolean };

const LogoutButton = ({ collapsed }: LogoutBtnProps) => {
  const logout = useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => {
      window.location.href = utils.url("/auth/login");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Logout failed";
      toast.error(msg);
    },
  });
  return (
    <button
      type="button"
      onClick={() => logout.mutate()}
      disabled={logout.isPending}
      className={cn(
        "flex items-center gap-2.5 h-8 rounded-gw-sm text-body-sm font-medium text-fg-secondary hover:bg-base-200 hover:text-fg-primary w-full transition-colors duration-100 ease-gw",
        collapsed ? "justify-center px-0" : "px-2.5"
      )}
      title="Sign out"
    >
      <LogOut size={16} strokeWidth={1.75} />
      {!collapsed && <span>Sign out</span>}
    </button>
  );
};

export default Sidebar;
