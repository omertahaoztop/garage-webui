import { PageContext } from "@/context/page-context";
import { Suspense, useContext, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../containers/sidebar";
import CommandPalette from "../containers/command-palette";
import { ArrowLeft, MenuIcon, Moon, ShieldCheck, Sun } from "lucide-react";
import { useDisclosure } from "@/hooks/useDisclosure";
import { Drawer } from "react-daisyui";
import { useAuth } from "@/hooks/useAuth";
import appStore from "@/stores/app-store";
import { Themes } from "@/app/themes";
import { useCurrentToken } from "@/pages/admin-tokens/hooks";

// Inverted-L app shell. Sidebar holds vertical navigation (Drawer side); main
// region stacks a 56px header above a scrollable content area. Header carries
// a single H1 (page title) + optional actions; breadcrumb-level chrome lives
// inside each page's own toolbar.
//
// CommandPalette is mounted as a sibling to the Drawer so its z-50 overlay
// renders above all Drawer chrome regardless of mobile/desktop state.

const MainLayout = () => {
  const sidebar = useDisclosure();
  const { pathname } = useLocation();
  const auth = useAuth();

  useEffect(() => {
    if (sidebar.isOpen) {
      sidebar.onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (auth.isLoading) {
    return null;
  }
  if (!auth.isAuthenticated) {
    return <Navigate to="/auth/login" />;
  }

  return (
    <>
      <Drawer
        open={sidebar.isOpen}
        onClickOverlay={sidebar.onClose}
        className="md:drawer-open h-screen max-h-dvh"
        side={<Sidebar />}
        contentClassName="flex flex-col overflow-hidden bg-base-200"
      >
        <Header onSidebarOpen={sidebar.onOpen} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Suspense>
            <Outlet />
          </Suspense>
        </main>
      </Drawer>
      <CommandPalette />
    </>
  );
};

type HeaderProps = {
  onSidebarOpen: () => void;
};

const Header = ({ onSidebarOpen }: HeaderProps) => {
  const page = useContext(PageContext);
  const navigate = useNavigate();
  // Local mirror of the persisted theme so the toggle re-renders when the
  // user cycles modes. Subscribe instead of useStore to avoid a hard
  // dependency on zustand's React adapter shape.
  const [theme, setTheme] = useState<Themes>(appStore.getState().theme);
  useEffect(() => {
    const unsub = appStore.subscribe((s) => setTheme(s.theme));
    return unsub;
  }, []);
  const isLight = theme === "garage-light";
  const toggleTheme = () => {
    appStore.setTheme(isLight ? "garage-dark" : "garage-light");
  };

  return (
    <header className="bg-base-100 border-b border-hairline px-4 md:px-6 shrink-0">
      <div className="h-14 flex items-center gap-3">
        {page?.prev ? (
          <button
            type="button"
            onClick={() => navigate(page.prev!, { replace: true })}
            className="w-8 h-8 -ml-1 flex items-center justify-center rounded-gw-sm hover:bg-base-200 text-fg-secondary hover:text-fg-primary transition-colors duration-100"
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSidebarOpen}
            className="md:hidden w-8 h-8 -ml-1 flex items-center justify-center rounded-gw-sm hover:bg-base-200 text-fg-secondary"
            title="Menu"
          >
            <MenuIcon size={18} />
          </button>
        )}
        <h1 className="text-h3 font-semibold tracking-[-0.01em] flex-1 truncate text-fg-primary">
          {page?.title || "Dashboard"}
        </h1>
        <ScopeBadge />
        {page?.actions && (
          <div className="flex items-center gap-2 shrink-0">{page.actions}</div>
        )}
        <button
          type="button"
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-gw-sm hover:bg-base-200 text-fg-secondary hover:text-fg-primary transition-colors duration-100"
          title={isLight ? "Switch to dark theme" : "Switch to light theme"}
        >
          {isLight ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>
    </header>
  );
};

const ScopeBadge = () => {
  const { isAdmin } = useAuth();
  const { data } = useCurrentToken({ enabled: isAdmin });
  if (!isAdmin || !data) return null;
  const scopes = data.scope ?? [];
  const isFull = scopes.includes("*");
  const label = isFull ? "full access" : `${scopes.length} scope${scopes.length === 1 ? "" : "s"}`;
  return (
    <span
      className="hidden sm:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-gw-sm border border-hairline bg-base-200 text-xs text-fg-secondary shrink-0"
      title={`Admin token: ${data.name}\nScope: ${scopes.join(", ")}`}
    >
      <ShieldCheck size={13} className={isFull ? "text-success" : "text-fg-muted"} />
      <span className="font-medium truncate max-w-[120px]">{data.name}</span>
      <span className="text-fg-muted">·</span>
      <span>{label}</span>
    </span>
  );
};

export default MainLayout;
