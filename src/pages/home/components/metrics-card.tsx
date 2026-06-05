import { useMemo } from "react";
import { Activity, AlertTriangle, Gauge, RefreshCw } from "lucide-react";
import { readableBytes, cn } from "@/lib/utils";
import { useMetrics, sumMetric, firstMetric } from "../metrics-hooks";

const MetricsCard = () => {
  const { data, isLoading, isError, error, refetch, isFetching } = useMetrics();

  const stats = useMemo(() => {
    if (!data) return null;

    const healthy = firstMetric(data, "cluster_healthy");
    const available = firstMetric(data, "cluster_available");
    const storageOk = firstMetric(data, "cluster_storage_nodes_ok") ?? 0;
    const storageTotal = firstMetric(data, "cluster_storage_nodes") ?? 0;
    const partsAllOk = firstMetric(data, "cluster_partitions_all_ok") ?? 0;
    const partsTotal = firstMetric(data, "cluster_partitions") ?? 0;

    const resyncErrored = firstMetric(data, "block_resync_errored_blocks") ?? 0;
    const resyncQueue = firstMetric(data, "block_resync_queue_length") ?? 0;
    const ramBufferKb = firstMetric(data, "block_ram_buffer_free_kb") ?? 0;

    // Disk avail/total are per-volume (data/metadata) per-node; sum data volume.
    const diskAvail = (data.byName.get("garage_local_disk_avail") ?? [])
      .filter((s) => s.labels.volume === "data")
      .reduce((a, s) => a + s.value, 0);
    const diskTotal = (data.byName.get("garage_local_disk_total") ?? [])
      .filter((s) => s.labels.volume === "data")
      .reduce((a, s) => a + s.value, 0);

    const s3Requests = sumMetric(data, "api_s3_request_counter");
    const s3Errors = sumMetric(data, "api_s3_error_counter");

    return {
      healthy,
      available,
      storageOk,
      storageTotal,
      partsAllOk,
      partsTotal,
      resyncErrored,
      resyncQueue,
      ramBufferKb,
      diskAvail,
      diskTotal,
      s3Requests,
      s3Errors,
    };
  }, [data]);

  return (
    <div className="rounded-gw-md border border-hairline bg-base-100 p-4 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-gw-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Gauge size={18} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-fg-primary">Live Metrics</h3>
            <p className="text-sm text-base-content/60 mt-0.5">
              Scraped from the cluster's Prometheus endpoint (10s refresh).
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-9 w-9 rounded-gw-sm border border-hairline bg-base-200 hover:bg-base-300 flex items-center justify-center disabled:opacity-50"
          title="Refresh metrics"
        >
          <RefreshCw size={14} className={cn(isFetching && "animate-spin")} />
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-base-content/60 mt-4">Loading metrics…</p>
      ) : isError ? (
        <div className="mt-4 rounded-gw-sm border border-warning/40 bg-warning/5 px-3 py-2 text-sm text-warning flex items-center gap-2">
          <AlertTriangle size={14} />
          {error instanceof Error ? error.message : "Metrics endpoint unavailable"}
          <span className="text-xs text-base-content/50">
            (set <code className="font-mono">metrics_token</code> or grant the admin token metrics scope)
          </span>
        </div>
      ) : stats ? (
        <>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <Metric
              label="Cluster"
              value={stats.healthy === 1 ? "Healthy" : stats.available === 1 ? "Degraded" : "Unhealthy"}
              tone={stats.healthy === 1 ? "success" : stats.available === 1 ? "warning" : "error"}
            />
            <Metric
              label="Storage Nodes OK"
              value={`${stats.storageOk}/${stats.storageTotal}`}
              tone={stats.storageOk >= stats.storageTotal ? "success" : "warning"}
            />
            <Metric
              label="Partitions All-OK"
              value={`${stats.partsAllOk}/${stats.partsTotal}`}
              tone={stats.partsAllOk >= stats.partsTotal ? "success" : "warning"}
            />
            <Metric
              label="Resync Errored"
              value={String(stats.resyncErrored)}
              tone={stats.resyncErrored === 0 ? "success" : "error"}
              hint="Should be 0 in a healthy cluster"
            />
            <Metric label="Resync Queue" value={String(stats.resyncQueue)} tone="muted" />
            <Metric
              label="RAM Buffer Free"
              value={readableBytes(stats.ramBufferKb * 1024)}
              tone={stats.ramBufferKb === 0 ? "warning" : "muted"}
              hint="Zero = backpressure applied"
            />
            <Metric
              label="Disk Free (data)"
              value={
                stats.diskTotal > 0
                  ? `${readableBytes(stats.diskAvail)} / ${readableBytes(stats.diskTotal)}`
                  : "—"
              }
              tone="muted"
            />
            <Metric
              label="S3 Requests"
              value={stats.s3Requests.toLocaleString()}
              tone="muted"
              icon={<Activity size={12} />}
            />
          </div>

          {stats.s3Requests > 0 && (
            <p className="text-xs text-base-content/50 mt-3">
              S3 error rate:{" "}
              <span className={cn(stats.s3Errors > 0 ? "text-warning" : "text-success")}>
                {((stats.s3Errors / stats.s3Requests) * 100).toFixed(2)}%
              </span>{" "}
              ({stats.s3Errors.toLocaleString()} errors)
            </p>
          )}
        </>
      ) : null}
    </div>
  );
};

const Metric = ({
  label,
  value,
  tone,
  hint,
  icon,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "error" | "muted";
  hint?: string;
  icon?: React.ReactNode;
}) => (
  <div
    className="rounded-gw-sm border border-hairline bg-base-200/40 px-3 py-2"
    title={hint}
  >
    <p className="text-[11px] text-base-content/50 inline-flex items-center gap-1">
      {icon}
      {label}
    </p>
    <p
      className={cn(
        "text-sm font-semibold mt-0.5",
        tone === "success" && "text-success",
        tone === "warning" && "text-warning",
        tone === "error" && "text-error",
        tone === "muted" && "text-fg-primary"
      )}
    >
      {value}
    </p>
  </div>
);

export default MetricsCard;
