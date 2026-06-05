import { createStore } from "zustand";
import { persist } from "zustand/middleware";
import { useStore } from "zustand";

type ClusterState = {
  /** Active cluster ID. Empty string => use backend default. */
  activeId: string;
};

const store = createStore(
  persist<ClusterState>(
    () => ({
      activeId: "",
    }),
    {
      name: "cluster", // localStorage key
    }
  )
);

/**
 * Vanilla store + helpers. Mirrors src/stores/app-store.ts pattern.
 *
 * Non-reactive access: `clusterStore.getState().activeId` — used from
 * src/lib/api.ts to inject the `X-Cluster-Id` header without coupling to
 * React lifecycles.
 *
 * Reactive access in components: `clusterStore.useStore(s => s.activeId)`
 * or the higher-level `useActiveCluster()` hook.
 */
const clusterStore = {
  ...store,

  /** Set active cluster id; empty string clears it so backend default is used. */
  setActiveId: (id: string) => store.setState({ activeId: id || "" }),

  /** Convenience: read the active cluster id without subscribing. */
  getActiveId: () => store.getState().activeId,

  /** React hook for reactive subscription to the store. */
  useStore: <T>(selector: (s: ClusterState) => T) => useStore(store, selector),
};

export default clusterStore;
