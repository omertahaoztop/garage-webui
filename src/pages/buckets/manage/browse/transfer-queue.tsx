import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
  XCircle,
} from "lucide-react";
import { cn, readableBytes } from "@/lib/utils";
import transferStore, { Transfer, TransferStatus } from "@/stores/transfer-store";

/**
 * TransferQueue is the bottom-right floating progress panel. Renders nothing
 * when the queue is empty — only appears once an upload starts.
 */
const TransferQueue = () => {
  const transfers = transferStore.useStore((s) => s.transfers);
  const [collapsed, setCollapsed] = useState(false);

  if (transfers.length === 0) return null;

  const active = transfers.filter(
    (t) => t.status === "queued" || t.status === "uploading"
  ).length;
  const done = transfers.filter((t) => t.status === "done").length;
  const failed = transfers.filter(
    (t) => t.status === "error" || t.status === "cancelled"
  ).length;

  return (
    <div
      className={cn(
        "fixed right-4 bottom-4 z-30 w-full max-w-sm",
        "rounded-xl border border-base-300 bg-base-100 shadow-xl"
      )}
      role="region"
      aria-label="Upload queue"
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-base-300">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {active > 0 && (
            <Loader2 size={16} className="animate-spin text-primary" />
          )}
          <span>
            Transfers
            <span className="text-base-content/60 font-normal ml-1">
              ({active} active{done ? `, ${done} done` : ""}
              {failed ? `, ${failed} failed` : ""})
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(done > 0 || failed > 0) && (
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => transferStore.clearFinished()}
            >
              Clear
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-circle"
            aria-label={collapsed ? "Expand" : "Collapse"}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <ul className="max-h-72 overflow-y-auto divide-y divide-base-300">
          {transfers.map((t) => (
            <TransferRow key={t.id} transfer={t} />
          ))}
        </ul>
      )}
    </div>
  );
};

const TransferRow = ({ transfer }: { transfer: Transfer }) => {
  const { id, fileName, fileSize, status, progress, error } = transfer;
  const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));

  return (
    <li className="px-4 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium" title={fileName}>
          {fileName}
        </span>
        <StatusIcon status={status} />
      </div>

      <div className="mt-1 flex items-center gap-2">
        <progress
          className={cn(
            "progress flex-1 h-1.5",
            status === "error" || status === "cancelled"
              ? "progress-error"
              : status === "done"
              ? "progress-success"
              : "progress-primary"
          )}
          value={pct}
          max={100}
        />
        <span className="text-xs text-base-content/60 w-16 text-right tabular-nums">
          {status === "uploading"
            ? `${pct}%`
            : status === "done"
            ? readableBytes(fileSize)
            : status === "error"
            ? "Error"
            : status === "cancelled"
            ? "Cancelled"
            : "Queued"}
        </span>

        {(status === "uploading" || status === "queued") && (
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-circle"
            aria-label="Cancel"
            onClick={() => transferStore.cancel(id)}
          >
            <X size={14} />
          </button>
        )}
        {(status === "done" || status === "cancelled" || status === "error") && (
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-circle"
            aria-label="Remove from list"
            onClick={() => transferStore.remove(id)}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {error && (
        <p className="mt-1 text-xs text-error truncate" title={error}>
          {error}
        </p>
      )}
    </li>
  );
};

const StatusIcon = ({ status }: { status: TransferStatus }) => {
  switch (status) {
    case "done":
      return <CheckCircle2 size={16} className="text-success" />;
    case "error":
    case "cancelled":
      return <XCircle size={16} className="text-error" />;
    case "uploading":
      return <Loader2 size={16} className="animate-spin text-primary" />;
    default:
      return <span className="block w-4 h-4 rounded-full bg-base-300" />;
  }
};

export default TransferQueue;
