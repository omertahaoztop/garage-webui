import Page from "@/context/page-context";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, SlidersHorizontal, Cog } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useWorkers,
  useSetWorkerVariable,
  WORKER_VARIABLE_PRESETS,
  type WorkerInfo,
} from "./hooks";

type FlatWorker = WorkerInfo & { node: string };

const stateLabel = (state: unknown): { label: string; tone: string } => {
  // Garage WorkerState is an enum that serialises either as a string
  // ("idle", "done") or an object ({ busy: ... } / { throttled: {...} }).
  if (typeof state === "string") {
    if (state === "idle") return { label: "idle", tone: "text-base-content/50" };
    if (state === "done") return { label: "done", tone: "text-success" };
    return { label: state, tone: "text-base-content/70" };
  }
  if (state && typeof state === "object") {
    const key = Object.keys(state as object)[0] ?? "active";
    const tone = key === "throttled" ? "text-warning" : "text-primary";
    return { label: key, tone };
  }
  return { label: "—", tone: "text-base-content/50" };
};

const WorkersPage = () => {
  const [busyOnly, setBusyOnly] = useState(false);
  const [errorOnly, setErrorOnly] = useState(false);
  const workersQuery = useWorkers("*", { busyOnly, errorOnly });
  const setVar = useSetWorkerVariable();
  const [varName, setVarName] = useState(WORKER_VARIABLE_PRESETS[0]);
  const [varValue, setVarValue] = useState("");

  const flat = useMemo<FlatWorker[]>(() => {
    const out: FlatWorker[] = [];
    const success = workersQuery.data?.success ?? {};
    for (const [node, list] of Object.entries(success)) {
      for (const w of list ?? []) out.push({ ...w, node });
    }
    return out.sort((a, b) => a.id - b.id || a.node.localeCompare(b.node));
  }, [workersQuery.data]);

  const nodeErrors = workersQuery.data?.error ?? {};

  const applyVar = async () => {
    if (!varName.trim()) return;
    try {
      await setVar.mutateAsync({ variable: varName.trim(), value: varValue.trim() });
      toast.success(`Set ${varName} = ${varValue}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set variable");
    }
  };

  return (
    <div className="container">
      <Page title="Workers" />

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-fg-primary">Workers</h1>
          <p className="text-sm text-base-content/60 mt-0.5">
            Background maintenance tasks across all cluster nodes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => workersQuery.refetch()}
          disabled={workersQuery.isFetching}
          className="h-9 w-9 rounded-gw-sm border border-hairline bg-base-200 hover:bg-base-300 flex items-center justify-center disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={14} className={cn(workersQuery.isFetching && "animate-spin")} />
        </button>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <FilterToggle active={busyOnly} onClick={() => setBusyOnly((v) => !v)} label="Busy only" />
        <FilterToggle active={errorOnly} onClick={() => setErrorOnly((v) => !v)} label="Error only" />
      </div>

      {/* Variable tuning */}
      <div className="mt-4 rounded-gw-md border border-hairline bg-base-100 p-4">
        <h3 className="text-sm font-semibold text-fg-primary mb-3 inline-flex items-center gap-2">
          <SlidersHorizontal size={14} /> Worker Tuning
        </h3>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-base-content/60">Variable</label>
            <input
              list="worker-var-presets"
              value={varName}
              onChange={(e) => setVarName(e.target.value)}
              className="w-full h-9 px-2 rounded-gw-sm border border-hairline bg-base-200 text-sm"
            />
            <datalist id="worker-var-presets">
              {WORKER_VARIABLE_PRESETS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="text-xs text-base-content/60">Value</label>
            <input
              value={varValue}
              onChange={(e) => setVarValue(e.target.value)}
              placeholder="e.g. 2"
              className="w-full h-9 px-2 rounded-gw-sm border border-hairline bg-base-200 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={applyVar}
            disabled={setVar.isPending || !varName.trim()}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-gw-sm text-sm font-medium bg-primary text-primary-content hover:bg-primary/90 disabled:opacity-60"
          >
            {setVar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Cog size={14} />}
            Set on all nodes
          </button>
        </div>
      </div>

      {Object.keys(nodeErrors).length > 0 && (
        <div className="mt-4 rounded-gw-sm border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning">
          {Object.entries(nodeErrors).map(([node, err]) => (
            <div key={node}>
              <span className="font-mono">{node.slice(0, 16)}</span>: {err}
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="mt-4 rounded-gw-md border border-hairline overflow-hidden">
        {workersQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-base-content/60 p-4">
            <Loader2 size={16} className="animate-spin" /> Loading workers…
          </div>
        ) : flat.length === 0 ? (
          <p className="text-sm text-base-content/60 p-4">No workers match the filter.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-base-200 text-base-content/60 text-xs">
              <tr>
                <th className="text-left font-medium px-3 py-2">ID</th>
                <th className="text-left font-medium px-3 py-2">Name</th>
                <th className="text-left font-medium px-3 py-2">Node</th>
                <th className="text-left font-medium px-3 py-2">State</th>
                <th className="text-left font-medium px-3 py-2">Progress</th>
                <th className="text-right font-medium px-3 py-2">Queue</th>
                <th className="text-right font-medium px-3 py-2">Errors</th>
              </tr>
            </thead>
            <tbody>
              {flat.map((w) => {
                const st = stateLabel(w.state);
                return (
                  <tr key={`${w.node}-${w.id}`} className="border-t border-hairline">
                    <td className="px-3 py-2 font-mono text-xs">{w.id}</td>
                    <td className="px-3 py-2">{w.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-base-content/60">
                      {w.node.slice(0, 12)}
                    </td>
                    <td className={cn("px-3 py-2 text-xs font-medium", st.tone)}>{st.label}</td>
                    <td className="px-3 py-2 text-xs text-base-content/70">{w.progress ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-xs">{w.queueLength ?? "—"}</td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right text-xs font-medium",
                        w.errors > 0 ? "text-error" : "text-base-content/40"
                      )}
                    >
                      {w.errors}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const FilterToggle = ({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "h-8 px-3 rounded-gw-sm text-sm font-medium border transition-colors",
      active
        ? "border-primary/40 bg-primary/10 text-primary"
        : "border-hairline bg-base-100 text-base-content/70 hover:bg-base-200"
    )}
  >
    {label}
  </button>
);

export default WorkersPage;
