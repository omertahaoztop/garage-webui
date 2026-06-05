import { cn } from "@/lib/utils";
import { useActiveCluster, useClusterHealth } from "@/hooks/useClusters";
import type { ClusterPublic } from "@/types/garage";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronsUpDown,
  CircleSlash,
  Server,
  XCircle,
} from "lucide-react";
import { Dropdown } from "react-daisyui";

type ClusterSwitcherProps = {
  className?: string;
};

/**
 * Cluster picker mounted at the top of the sidebar (TR roadmap: "sidebar
 * üstüne"). Hides itself when only one cluster is configured — the
 * single-cluster env-var mode should look identical to the pre-refactor UI.
 */
const ClusterSwitcher = ({ className }: ClusterSwitcherProps) => {
  const { clusters, active, setActiveId, isLoading } = useActiveCluster();
  const queryClient = useQueryClient();

  // Hide entirely when the registry only knows one cluster: no UX value in
  // showing a one-option dropdown, but the request still carries no X-Cluster-Id
  // (backend falls back to default).
  if (isLoading || clusters.length <= 1) {
    return null;
  }

  const onSelect = (c: ClusterPublic) => {
    if (c.id === active?.id) return;
    setActiveId(c.id);
    // Bust cluster-scoped caches so the UI repaints against the new endpoint.
    queryClient.invalidateQueries({ queryKey: ["buckets"] });
    queryClient.invalidateQueries({ queryKey: ["config"] });
    queryClient.invalidateQueries({ queryKey: ["browse"] });
    queryClient.invalidateQueries({ queryKey: ["cluster-test"] });
  };

  return (
    <div className={cn("px-3 pb-2", className)}>
      <Dropdown className="w-full">
        <Dropdown.Toggle button={false} className="w-full">
          <button
            type="button"
            className="btn btn-sm w-full justify-between bg-base-200 hover:bg-base-300 border-none normal-case font-normal"
            aria-label="Switch cluster"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Server size={14} className="shrink-0" />
              <span className="truncate">{active?.name ?? "Select cluster"}</span>
              {active && <HealthDot id={active.id} />}
            </span>
            <ChevronsUpDown size={14} className="shrink-0 opacity-60" />
          </button>
        </Dropdown.Toggle>

        <Dropdown.Menu className="w-[230px] max-h-[400px] overflow-y-auto bg-base-100 border border-base-300/50 z-50">
          <li className="menu-title text-xs">
            <span>Clusters ({clusters.length})</span>
          </li>
          {clusters.map((c) => (
            <Dropdown.Item
              key={c.id}
              onClick={() => onSelect(c)}
              className={cn(
                "flex items-center justify-between gap-2",
                c.id === active?.id && "bg-base-200"
              )}
            >
              <span className="flex items-center gap-2 min-w-0 flex-1">
                <HealthDot id={c.id} />
                <span className="truncate" title={c.adminUrl}>
                  {c.name}
                </span>
                {c.isDefault && (
                  <span className="badge badge-ghost badge-xs">default</span>
                )}
              </span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
};

const HealthDot = ({ id }: { id: string }) => {
  const { data, isLoading } = useClusterHealth(id);

  if (isLoading || !data) {
    return (
      <span
        className="inline-block h-2 w-2 rounded-full bg-base-300 animate-pulse"
        aria-label="probing"
      />
    );
  }
  if (!data.ok) {
    return (
      <XCircle
        size={12}
        className="text-error shrink-0"
        aria-label={data.error || "unreachable"}
      />
    );
  }
  if (data.health?.status === "healthy") {
    return (
      <CheckCircle2
        size={12}
        className="text-success shrink-0"
        aria-label="healthy"
      />
    );
  }
  return (
    <CircleSlash
      size={12}
      className="text-warning shrink-0"
      aria-label={data.health?.status || "degraded"}
    />
  );
};

export default ClusterSwitcher;
