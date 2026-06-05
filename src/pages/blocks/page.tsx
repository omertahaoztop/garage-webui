import Page from "@/context/page-context";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, AlertTriangle, RotateCw, Trash2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useBlockErrors,
  useBlockInfo,
  useRetryBlockResync,
  usePurgeBlocks,
  type BlockError,
  type BlockInfo,
} from "./hooks";

type FlatError = BlockError & { node: string };

const BlocksPage = () => {
  const errorsQuery = useBlockErrors("*");
  const blockInfo = useBlockInfo();
  const retry = useRetryBlockResync();
  const purge = usePurgeBlocks();

  const [detail, setDetail] = useState<{ node: string; info: BlockInfo } | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<FlatError | null>(null);
  const [purgeConfirm, setPurgeConfirm] = useState("");

  const flat = useMemo<FlatError[]>(() => {
    const out: FlatError[] = [];
    const success = errorsQuery.data?.success ?? {};
    for (const [node, list] of Object.entries(success)) {
      for (const e of list ?? []) out.push({ ...e, node });
    }
    return out.sort((a, b) => b.errorCount - a.errorCount);
  }, [errorsQuery.data]);

  const nodeErrors = errorsQuery.data?.error ?? {};

  const openDetail = async (e: FlatError) => {
    try {
      const res = await blockInfo.mutateAsync({ node: e.node, blockHash: e.blockHash });
      const info = res.success[e.node];
      if (info) setDetail({ node: e.node, info });
      else toast.error("No info returned for this block");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load block info");
    }
  };

  const doRetry = async (e: FlatError) => {
    try {
      await retry.mutateAsync({ node: e.node, blockHashes: [e.blockHash] });
      toast.success("Resync retry queued");
      errorsQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    }
  };

  const doRetryAll = async () => {
    try {
      await retry.mutateAsync({ node: "*", all: true });
      toast.success("Retry queued on all nodes");
      errorsQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry-all failed");
    }
  };

  const doPurge = async () => {
    if (!purgeTarget || purgeConfirm !== "DELETE") return;
    try {
      await purge.mutateAsync({ node: purgeTarget.node, blockHashes: [purgeTarget.blockHash] });
      toast.success("Block purged");
      setPurgeTarget(null);
      setPurgeConfirm("");
      errorsQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Purge failed");
    }
  };

  return (
    <div className="container">
      <Page title="Block Errors" />

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-fg-primary">Block Errors</h1>
          <p className="text-sm text-base-content/60 mt-0.5">
            Data blocks that failed to resync. Investigate, retry, or purge (destructive).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={doRetryAll}
            disabled={retry.isPending}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-gw-sm text-sm font-medium border border-hairline bg-base-200 hover:bg-base-300 disabled:opacity-50"
          >
            {retry.isPending ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
            Retry All
          </button>
          <button
            type="button"
            onClick={() => errorsQuery.refetch()}
            disabled={errorsQuery.isFetching}
            className="h-9 w-9 rounded-gw-sm border border-hairline bg-base-200 hover:bg-base-300 flex items-center justify-center disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={cn(errorsQuery.isFetching && "animate-spin")} />
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

      <div className="mt-4 rounded-gw-md border border-hairline overflow-hidden">
        {errorsQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-base-content/60 p-4">
            <Loader2 size={16} className="animate-spin" /> Loading block errors…
          </div>
        ) : flat.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-success p-4">
            <AlertTriangle size={16} className="text-success" /> No block errors — cluster healthy.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-base-200 text-base-content/60 text-xs">
              <tr>
                <th className="text-left font-medium px-3 py-2">Block Hash</th>
                <th className="text-left font-medium px-3 py-2">Node</th>
                <th className="text-right font-medium px-3 py-2">Refs</th>
                <th className="text-right font-medium px-3 py-2">Errors</th>
                <th className="text-right font-medium px-3 py-2">Last Try</th>
                <th className="text-right font-medium px-3 py-2">Next Try</th>
                <th className="text-right font-medium px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {flat.map((e) => (
                <tr key={`${e.node}-${e.blockHash}`} className="border-t border-hairline">
                  <td className="px-3 py-2 font-mono text-xs truncate max-w-[200px]" title={e.blockHash}>
                    {e.blockHash.slice(0, 24)}…
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-base-content/60">
                    {e.node.slice(0, 12)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">{e.refcount}</td>
                  <td className="px-3 py-2 text-right text-xs text-error font-medium">
                    {e.errorCount}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-base-content/60">
                    {e.lastTrySecsAgo}s ago
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-base-content/60">
                    in {e.nextTryInSecs}s
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn title="Info" onClick={() => openDetail(e)}>
                        <Info size={13} />
                      </IconBtn>
                      <IconBtn title="Retry resync" onClick={() => doRetry(e)}>
                        <RotateCw size={13} />
                      </IconBtn>
                      <IconBtn
                        title="Purge (destructive)"
                        danger
                        onClick={() => {
                          setPurgeTarget(e);
                          setPurgeConfirm("");
                        }}
                      >
                        <Trash2 size={13} />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Block info drawer */}
      {detail && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setDetail(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative w-full max-w-md bg-base-100 h-full shadow-xl overflow-y-auto p-5"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">Block Detail</h3>
              <button onClick={() => setDetail(null)} className="text-base-content/50 hover:text-base-content">
                <X size={18} />
              </button>
            </div>
            <dl className="space-y-2 text-sm">
              <Row label="Hash" value={detail.info.blockHash} mono />
              <Row label="Node" value={detail.node} mono />
              <Row label="Refcount" value={String(detail.info.refcount)} />
            </dl>
            <h4 className="text-sm font-semibold mt-4 mb-2">
              Versions ({detail.info.versions?.length ?? 0})
            </h4>
            <ul className="space-y-2">
              {detail.info.versions?.map((v) => (
                <li key={v.versionId} className="rounded-gw-sm border border-hairline bg-base-200/40 px-3 py-2 text-xs">
                  <p className="font-mono truncate">{v.versionId}</p>
                  <div className="flex flex-wrap gap-2 mt-1 text-base-content/60">
                    {v.refDeleted && <span className="text-warning">ref-deleted</span>}
                    {v.versionDeleted && <span className="text-warning">version-deleted</span>}
                    {v.garbageCollected && <span className="text-error">gc'd</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Purge confirmation modal */}
      {purgeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setPurgeTarget(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-md bg-base-100 rounded-gw-md shadow-xl p-5"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-error mb-2">
              <AlertTriangle size={18} />
              <h3 className="text-base font-semibold">Purge Block</h3>
            </div>
            <p className="text-sm text-base-content/70 mb-3">
              This permanently deletes block{" "}
              <span className="font-mono text-xs">{purgeTarget.blockHash.slice(0, 24)}…</span> and
              any objects/versions that reference it. This cannot be undone.
            </p>
            <p className="text-xs text-base-content/60 mb-1">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm:
            </p>
            <input
              value={purgeConfirm}
              onChange={(e) => setPurgeConfirm(e.target.value)}
              className="w-full h-9 px-2 rounded-gw-sm border border-error/40 bg-base-200 text-sm mb-3"
              placeholder="DELETE"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPurgeTarget(null)}
                className="h-9 px-3 rounded-gw-sm text-sm border border-hairline bg-base-100 hover:bg-base-200"
              >
                Cancel
              </button>
              <button
                onClick={doPurge}
                disabled={purgeConfirm !== "DELETE" || purge.isPending}
                className="inline-flex items-center gap-2 h-9 px-3 rounded-gw-sm text-sm font-medium bg-error text-error-content hover:bg-error/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {purge.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Purge permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const IconBtn = ({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={cn(
      "h-7 w-7 rounded-gw-sm border border-hairline flex items-center justify-center",
      danger
        ? "text-error hover:bg-error/10"
        : "text-base-content/60 hover:bg-base-200 hover:text-base-content"
    )}
  >
    {children}
  </button>
);

const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex items-start justify-between gap-3">
    <dt className="text-base-content/50 shrink-0">{label}</dt>
    <dd className={cn("text-right break-all", mono && "font-mono text-xs")}>{value}</dd>
  </div>
);

export default BlocksPage;
