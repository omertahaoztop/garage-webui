import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Zap, ArrowUp, ArrowDown } from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { useBuckets } from "../../buckets/hooks";

type SpeedtestResult = {
  sizeBytes: number;
  putMBps: number;
  getMBps: number;
  putLatencyMs: number;
  getLatencyMs: number;
};

const SIZES = [
  { bytes: 1 << 10, label: "1 KiB" },
  { bytes: 1 << 20, label: "1 MiB" },
  { bytes: 10 << 20, label: "10 MiB" },
  { bytes: 100 << 20, label: "100 MiB" },
];

const SpeedtestCard = () => {
  const { data: buckets } = useBuckets();
  const [bucket, setBucket] = useState("");
  const [size, setSize] = useState(1 << 20);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SpeedtestResult | null>(null);

  const bucketNames = (buckets ?? [])
    .flatMap((b) => b.globalAliases ?? [])
    .filter(Boolean);

  const run = async () => {
    const target = bucket || bucketNames[0];
    if (!target) {
      toast.error("No bucket available for the speedtest");
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const res = await api.post<SpeedtestResult>("/speedtest", {
        params: { bucket: target, size },
      });
      setResult(res);
      toast.success("Speedtest complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speedtest failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-gw-md border border-hairline bg-base-100 p-4 md:p-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-gw-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Zap size={18} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-fg-primary">S3 Speedtest</h3>
          <p className="text-sm text-base-content/60 mt-0.5">
            Round-trip PUT/GET throughput probe against a bucket.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[160px]">
          <label className="text-xs text-base-content/60 block mb-1">Bucket</label>
          <select
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
            className="w-full h-9 px-2 rounded-gw-sm border border-hairline bg-base-200 text-sm"
          >
            <option value="">{bucketNames[0] ?? "No buckets"}</option>
            {bucketNames.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[120px]">
          <label className="text-xs text-base-content/60 block mb-1">Size</label>
          <select
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-full h-9 px-2 rounded-gw-sm border border-hairline bg-base-200 text-sm"
          >
            {SIZES.map((s) => (
              <option key={s.bytes} value={s.bytes}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running || bucketNames.length === 0}
          className={cn(
            "inline-flex items-center gap-2 h-9 px-3 rounded-gw-sm text-sm font-medium",
            "bg-primary text-primary-content hover:bg-primary/90",
            "disabled:opacity-60 disabled:cursor-not-allowed"
          )}
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          Run
        </button>
      </div>

      {result && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <ResultTile
            icon={<ArrowUp size={14} />}
            label="Upload"
            throughput={result.putMBps}
            latency={result.putLatencyMs}
          />
          <ResultTile
            icon={<ArrowDown size={14} />}
            label="Download"
            throughput={result.getMBps}
            latency={result.getLatencyMs}
          />
        </div>
      )}
    </div>
  );
};

const ResultTile = ({
  icon,
  label,
  throughput,
  latency,
}: {
  icon: React.ReactNode;
  label: string;
  throughput: number;
  latency: number;
}) => (
  <div className="rounded-gw-sm border border-hairline bg-base-200/40 px-3 py-2">
    <p className="text-[11px] text-base-content/50 inline-flex items-center gap-1">
      {icon}
      {label}
    </p>
    <p className="text-lg font-semibold text-fg-primary mt-0.5">
      {throughput.toFixed(1)}
      <span className="text-xs font-normal text-base-content/50 ml-1">MiB/s</span>
    </p>
    <p className="text-xs text-base-content/50">{latency.toFixed(0)} ms</p>
  </div>
);

export default SpeedtestCard;
