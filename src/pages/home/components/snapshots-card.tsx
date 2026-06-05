import { useState } from "react";
import { Card } from "react-daisyui";
import {
  Camera,
  CheckCircle2,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSnapshotNodes, useTriggerSnapshot } from "../hooks";

type LastRun = {
  at: number;
  scope: string;
  triggered: number;
  failed: number;
};

const SnapshotsCard = () => {
  const nodesQuery = useSnapshotNodes();
  const trigger = useTriggerSnapshot();
  const [pendingNode, setPendingNode] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<LastRun | null>(null);

  const nodes = nodesQuery.data?.nodes ?? [];

  const runSnapshot = async (node?: string, label?: string) => {
    setPendingNode(node || "*");
    try {
      const res = await trigger.mutateAsync({ node });
      const failedCount = Object.keys(res.failed || {}).length;
      const triggeredCount = res.triggered?.length ?? 0;
      setLastRun({
        at: Date.now(),
        scope: label || (node ? node.slice(0, 16) : "All nodes"),
        triggered: triggeredCount,
        failed: failedCount,
      });
      if (failedCount > 0) {
        toast.error(
          `Snapshot partial: ${triggeredCount} ok, ${failedCount} failed`
        );
      } else {
        toast.success(
          `Snapshot triggered on ${triggeredCount} node${
            triggeredCount === 1 ? "" : "s"
          }`
        );
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Snapshot trigger failed"
      );
    } finally {
      setPendingNode(null);
    }
  };

  return (
    <Card className="bg-base-100">
      <Card.Body className="p-4 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-gw-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Camera size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-fg-primary">
                Cluster Metadata Snapshots
              </h3>
              <p className="text-sm text-base-content/60 mt-0.5">
                Trigger an on-demand metadata snapshot on one or all nodes. Used
                for point-in-time backups and disaster recovery.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => nodesQuery.refetch()}
            disabled={nodesQuery.isFetching}
            className="shrink-0 h-9 w-9 rounded-gw-sm border border-hairline bg-base-200 hover:bg-base-300 flex items-center justify-center disabled:opacity-50"
            title="Refresh node list"
          >
            <RefreshCw
              size={14}
              className={cn(nodesQuery.isFetching && "animate-spin")}
            />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => runSnapshot()}
            disabled={trigger.isPending}
            className={cn(
              "inline-flex items-center gap-2 h-9 px-3 rounded-gw-sm text-sm font-medium",
              "bg-primary text-primary-content hover:bg-primary/90",
              "disabled:opacity-60 disabled:cursor-not-allowed"
            )}
          >
            {pendingNode === "*" && trigger.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Camera size={14} />
            )}
            Snapshot All Nodes
          </button>
          {lastRun && (
            <div className="flex items-center gap-2 text-xs text-base-content/60 ml-auto">
              <span>
                Last: {lastRun.scope} ·{" "}
                <span className="text-success">{lastRun.triggered} ok</span>
                {lastRun.failed > 0 && (
                  <>
                    {" "}
                    · <span className="text-error">{lastRun.failed} failed</span>
                  </>
                )}
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-hairline pt-4">
          {nodesQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-base-content/60">
              <Loader2 size={14} className="animate-spin" /> Loading nodes…
            </div>
          ) : nodes.length === 0 ? (
            <p className="text-sm text-base-content/60">No nodes available.</p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {nodes.map((node) => {
                const busy = pendingNode === node.id && trigger.isPending;
                return (
                  <li
                    key={node.id}
                    className="flex items-center justify-between gap-3 rounded-gw-sm border border-hairline bg-base-200/50 px-3 py-2"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      {node.isUp ? (
                        <CheckCircle2
                          size={14}
                          className="text-success shrink-0"
                        />
                      ) : (
                        <XCircle size={14} className="text-error shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {node.hostname || node.shortId}
                          {node.zone && (
                            <span className="ml-2 text-xs text-base-content/50 font-normal">
                              {node.zone}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-base-content/50 font-mono truncate">
                          {node.shortId}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        runSnapshot(node.id, node.hostname || node.shortId)
                      }
                      disabled={trigger.isPending || !node.isUp}
                      className={cn(
                        "shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-gw-sm text-xs font-medium border border-hairline",
                        "bg-base-100 hover:bg-base-300",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      {busy ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Camera size={12} />
                      )}
                      Snapshot
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card.Body>
    </Card>
  );
};

export default SnapshotsCard;
