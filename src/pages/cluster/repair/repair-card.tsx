import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Wrench, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRepairTypes, useLaunchRepair } from "./hooks";

const SCRUB_COMMANDS = ["start", "pause", "resume", "cancel"];

const RepairCard = () => {
  const typesQuery = useRepairTypes();
  const launch = useLaunchRepair();
  const [selected, setSelected] = useState<string>("");
  const [scrubCmd, setScrubCmd] = useState("start");

  const types = typesQuery.data?.types ?? [];

  const run = async () => {
    if (!selected) {
      toast.error("Select a repair type");
      return;
    }
    const repairType =
      selected === "scrub" ? { scrub: scrubCmd } : selected;
    if (
      !window.confirm(
        `Launch "${selected}" repair on all nodes? This runs a background maintenance task.`
      )
    )
      return;
    try {
      const res = await launch.mutateAsync({ node: "*", repairType });
      const failed = Object.keys(res.error || {}).length;
      const ok = Object.keys(res.success || {}).length;
      if (failed > 0) toast.error(`Repair: ${ok} ok, ${failed} failed`);
      else toast.success(`Repair "${selected}" launched on ${ok} node${ok === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Repair launch failed");
    }
  };

  return (
    <div className="rounded-gw-md border border-hairline bg-base-100 p-4 md:p-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-gw-md bg-warning/10 text-warning flex items-center justify-center shrink-0">
          <Wrench size={18} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-fg-primary">Repair Operations</h3>
          <p className="text-sm text-base-content/60 mt-0.5">
            Launch background repair tasks across the cluster (tables, blocks, scrub, rebalance…).
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs text-base-content/60 block mb-1">Repair type</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={typesQuery.isLoading}
            className="w-full h-9 px-2 rounded-gw-sm border border-hairline bg-base-200 text-sm"
          >
            <option value="">Select…</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            {typesQuery.data?.hasScrub && <option value="scrub">scrub</option>}
          </select>
        </div>

        {selected === "scrub" && (
          <div className="min-w-[140px]">
            <label className="text-xs text-base-content/60 block mb-1">Scrub command</label>
            <select
              value={scrubCmd}
              onChange={(e) => setScrubCmd(e.target.value)}
              className="w-full h-9 px-2 rounded-gw-sm border border-hairline bg-base-200 text-sm"
            >
              {SCRUB_COMMANDS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="button"
          onClick={run}
          disabled={launch.isPending || !selected}
          className={cn(
            "inline-flex items-center gap-2 h-9 px-3 rounded-gw-sm text-sm font-medium",
            "bg-warning text-warning-content hover:bg-warning/90",
            "disabled:opacity-60 disabled:cursor-not-allowed"
          )}
        >
          {launch.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          Launch
        </button>
      </div>
    </div>
  );
};

export default RepairCard;
