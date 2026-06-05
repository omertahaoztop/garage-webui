import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, FileSearch, Boxes } from "lucide-react";
import { readableBytes, cn } from "@/lib/utils";
import { useBucketContext } from "../context";
import { useInspectObject, type InspectResult, type InspectVersion } from "./hooks";

const InspectTab = () => {
  const { bucketName } = useBucketContext();
  const inspect = useInspectObject();
  const [key, setKey] = useState("");
  const [result, setResult] = useState<InspectResult | null>(null);

  const run = async () => {
    if (!key.trim()) {
      toast.error("Enter an object key");
      return;
    }
    try {
      const res = await inspect.mutateAsync({ bucket: bucketName, key: key.trim() });
      setResult(res);
      if (!res.versions?.length) toast.info("No versions found for this key");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Inspect failed");
      setResult(null);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-gw-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <FileSearch size={18} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-fg-primary">Object Inspector</h3>
          <p className="text-sm text-base-content/60 mt-0.5">
            Forensic view of an object's versions, blocks, and replication metadata.
          </p>
        </div>
      </div>

      <div className="flex items-end gap-2 mb-6">
        <div className="flex-1">
          <label className="text-xs text-base-content/60 block mb-1">Object key</label>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="path/to/object.bin"
            className="w-full h-9 px-2 rounded-gw-sm border border-hairline bg-base-200 text-sm font-mono"
          />
        </div>
        <button
          type="button"
          onClick={run}
          disabled={inspect.isPending || !key.trim()}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-gw-sm text-sm font-medium bg-primary text-primary-content hover:bg-primary/90 disabled:opacity-60"
        >
          {inspect.isPending ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Inspect
        </button>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="text-xs text-base-content/60">
            <span className="font-mono">{result.key}</span> ·{" "}
            <span className="font-mono">bucket {result.bucketId.slice(0, 16)}</span> ·{" "}
            {result.versions.length} version{result.versions.length === 1 ? "" : "s"}
          </div>
          {result.versions.map((v) => (
            <VersionCard key={v.uuid} version={v} />
          ))}
        </div>
      )}
    </div>
  );
};

const VersionCard = ({ version: v }: { version: InspectVersion }) => {
  const flags = [
    v.encrypted && "encrypted",
    v.inline && "inline",
    v.uploading && "uploading",
    v.aborted && "aborted",
    v.deleteMarker && "delete-marker",
  ].filter(Boolean) as string[];

  return (
    <div className="rounded-gw-md border border-hairline bg-base-100 p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-mono text-xs truncate">{v.uuid}</span>
        <span className="text-xs text-base-content/50">
          {new Date(v.timestamp).toLocaleString()}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {v.size != null && (
          <Badge tone="primary">{readableBytes(v.size)}</Badge>
        )}
        {flags.map((f) => (
          <Badge key={f} tone={f === "aborted" || f === "delete-marker" ? "error" : "muted"}>
            {f}
          </Badge>
        ))}
        {v.etag && (
          <Badge tone="muted" title={v.etag}>
            etag {v.etag.replace(/"/g, "").slice(0, 12)}
          </Badge>
        )}
      </div>

      {v.headers?.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-base-content/60 mb-1">Headers</p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
            {v.headers.map(([k, val], i) => (
              <div key={i} className="flex gap-1 min-w-0">
                <dt className="text-base-content/50 shrink-0">{k}:</dt>
                <dd className="font-mono truncate">{val}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {v.blocks?.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-base-content/60 mb-1 inline-flex items-center gap-1">
            <Boxes size={12} /> Blocks ({v.blocks.length})
          </p>
          <div className="rounded-gw-sm border border-hairline overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-base-200 text-base-content/50">
                <tr>
                  <th className="text-left font-medium px-2 py-1">Part</th>
                  <th className="text-left font-medium px-2 py-1">Hash</th>
                  <th className="text-right font-medium px-2 py-1">Offset</th>
                  <th className="text-right font-medium px-2 py-1">Size</th>
                </tr>
              </thead>
              <tbody>
                {v.blocks.map((b, i) => (
                  <tr key={i} className="border-t border-hairline">
                    <td className="px-2 py-1">{b.partNumber}</td>
                    <td className="px-2 py-1 font-mono truncate max-w-[160px]" title={b.hash}>
                      {b.hash.slice(0, 20)}…
                    </td>
                    <td className="px-2 py-1 text-right">{b.offset}</td>
                    <td className="px-2 py-1 text-right">{readableBytes(b.size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const Badge = ({
  children,
  tone,
  title,
}: {
  children: React.ReactNode;
  tone: "primary" | "error" | "muted";
  title?: string;
}) => (
  <span
    title={title}
    className={cn(
      "text-[10px] px-1.5 py-0.5 rounded font-medium",
      tone === "primary" && "bg-primary/10 text-primary",
      tone === "error" && "bg-error/10 text-error",
      tone === "muted" && "bg-base-300 text-base-content/70"
    )}
  >
    {children}
  </span>
);

export default InspectTab;
