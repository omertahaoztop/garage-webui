import { useEffect, useMemo, useState } from "react";
import {
  Download as DownloadIcon,
  Eye,
  FileIcon,
  HardDrive,
  Hash,
  Link2,
  Loader2,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import mime from "mime/lite";
import Button from "@/components/ui/button";
import { cn, dayjs, readableBytes } from "@/lib/utils";
import { API_URL } from "@/lib/api";
import { BrowserObject } from "./types";
import { useObjectMetadata } from "./hooks";
import { useBucketContext } from "../context";

type Props = {
  open: boolean;
  object?: BrowserObject;
  prefix?: string;
  onClose: () => void;
  onShare?: (o: BrowserObject) => void;
};

// Extensions we render as inline text (in addition to mime/text).
const TEXT_EXTS = [
  "json",
  "yaml",
  "yml",
  "xml",
  "csv",
  "tsv",
  "log",
  "ts",
  "tsx",
  "js",
  "jsx",
  "go",
  "py",
  "rs",
  "java",
  "rb",
  "sh",
  "bash",
  "zsh",
  "conf",
  "config",
  "ini",
  "toml",
  "env",
  "lock",
  "gitignore",
  "dockerignore",
  "dockerfile",
  "sql",
];

const MAX_INLINE_TEXT = 1024 * 1024; // 1 MB
const MAX_HEX_BYTES = 16 * 1024; // 16 KiB hex window

type ViewMode = "auto" | "hex";

const PreviewDrawer = ({
  open,
  object,
  prefix = "",
  onClose,
  onShare,
}: Props) => {
  const { bucketName } = useBucketContext();
  const fullKey = object ? prefix + object.objectKey : "";

  const { data: meta, isLoading: metaLoading } = useObjectMetadata(
    bucketName,
    fullKey,
    open && !!object
  );

  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("auto");
  const [hexBytes, setHexBytes] = useState<Uint8Array | null>(null);
  const [hexLoading, setHexLoading] = useState(false);
  const [hexTruncated, setHexTruncated] = useState(false);

  // Reset hex/view state when object changes.
  useEffect(() => {
    setViewMode("auto");
    setHexBytes(null);
    setHexTruncated(false);
  }, [object?.objectKey]);

  const fileExt = useMemo(() => {
    if (!object) return null;
    const i = object.objectKey.lastIndexOf(".");
    return i >= 0 ? object.objectKey.substring(i + 1).toLowerCase() : null;
  }, [object]);

  const mimeType = fileExt ? mime.getType(fileExt) : null;
  const mimeRoot = mimeType?.split("/")[0];

  const previewKind = useMemo<
    "image" | "video" | "audio" | "pdf" | "markdown" | "text" | "binary"
  >(() => {
    if (!fileExt) return "binary";
    if (mimeRoot === "image") return "image";
    if (mimeRoot === "video") return "video";
    if (mimeRoot === "audio") return "audio";
    if (fileExt === "pdf") return "pdf";
    if (fileExt === "md" || fileExt === "markdown") return "markdown";
    if (mimeRoot === "text" || TEXT_EXTS.includes(fileExt)) return "text";
    return "binary";
  }, [fileExt, mimeRoot]);

  // Fetch text/markdown body when drawer opens; otherwise reset.
  useEffect(() => {
    if (!open || !object || viewMode === "hex") {
      setTextContent(null);
      return;
    }
    if (previewKind !== "text" && previewKind !== "markdown") {
      setTextContent(null);
      return;
    }
    if ((object.size || 0) > MAX_INLINE_TEXT) {
      setTextContent(
        `(file too large to preview inline — ${readableBytes(
          object.size
        )}. Use the download button instead.)`
      );
      return;
    }

    let cancelled = false;
    setTextLoading(true);
    fetch(`${API_URL}${object.url}?view=1`, { credentials: "include" })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.statusText))))
      .then((t) => {
        if (!cancelled) setTextContent(t);
      })
      .catch((e) => {
        if (!cancelled) setTextContent(`Error loading content: ${e.message}`);
      })
      .finally(() => {
        if (!cancelled) setTextLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, object, previewKind, viewMode]);

  // Fetch hex bytes when hex view is requested.
  useEffect(() => {
    if (!open || !object || viewMode !== "hex" || hexBytes) return;
    let cancelled = false;
    setHexLoading(true);
    fetch(`${API_URL}${object.url}?view=1`, {
      credentials: "include",
      headers: { Range: `bytes=0-${MAX_HEX_BYTES - 1}` },
    })
      .then(async (r) => {
        if (!r.ok && r.status !== 206)
          throw new Error(r.statusText || `HTTP ${r.status}`);
        const buf = await r.arrayBuffer();
        if (cancelled) return;
        const bytes = new Uint8Array(buf);
        setHexBytes(bytes);
        setHexTruncated((object.size || 0) > bytes.length);
      })
      .catch(() => {
        if (!cancelled) setHexBytes(new Uint8Array(0));
      })
      .finally(() => {
        if (!cancelled) setHexLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, object, viewMode, hexBytes]);

  // ESC closes the drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!object) return null;

  const fileName = object.objectKey.split("/").pop() || object.objectKey;
  const viewUrl = `${API_URL}${object.url}?view=1`;
  const downloadUrl = `${API_URL}${object.url}?dl=1`;

  return (
    <>
      {/* Backdrop — desktop fades subtly so the drawer feels modal-anchored,
          mobile gets a stronger blur. */}
      <div
        className={`fixed inset-0 z-20 transition-opacity duration-200 ${
          open
            ? "opacity-100 bg-base-300/30 backdrop-blur-[2px] sm:backdrop-blur-none sm:bg-transparent"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed inset-y-0 right-0 z-30 w-full sm:w-[520px] bg-base-100 shadow-2xl border-l border-base-300 flex flex-col transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-base-300 shrink-0">
          <div className="flex-1 min-w-0 mr-2">
            <h3 className="font-semibold truncate" title={fileName}>
              {fileName}
            </h3>
            <p className="text-xs text-base-content/60 truncate">{fullKey}</p>
          </div>
          <Button
            icon={X}
            color="ghost"
            shape="circle"
            size="sm"
            onClick={onClose}
            title="Close (Esc)"
          />
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-1 p-2 border-b border-base-300 shrink-0">
          <Button
            icon={DownloadIcon}
            size="sm"
            color="ghost"
            onClick={() => window.open(downloadUrl, "_blank")}
          >
            Download
          </Button>
          {onShare && (
            <Button
              icon={Link2}
              size="sm"
              color="ghost"
              onClick={() => onShare(object)}
            >
              Share link
            </Button>
          )}

          {/* View mode toggle */}
          <div className="ml-auto flex gap-1">
            <button
              type="button"
              onClick={() => setViewMode("auto")}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-2.5 text-xs rounded-gw-sm border border-hairline",
                viewMode === "auto"
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "hover:bg-base-200"
              )}
              title="Auto preview"
            >
              <Eye size={12} /> Preview
            </button>
            <button
              type="button"
              onClick={() => setViewMode("hex")}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-2.5 text-xs rounded-gw-sm border border-hairline",
                viewMode === "hex"
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "hover:bg-base-200"
              )}
              title="Hex view (first 16 KiB)"
            >
              <Hash size={12} /> Hex
            </button>
          </div>
        </div>

        {/* Body: preview + metadata */}
        <div className="flex-1 overflow-y-auto p-3">
          {viewMode === "hex" ? (
            <HexView
              bytes={hexBytes}
              loading={hexLoading}
              truncated={hexTruncated}
              totalSize={object.size}
            />
          ) : (
            <>
              {previewKind === "image" && (
                <img
                  src={viewUrl}
                  alt={fileName}
                  className="max-w-full max-h-[55vh] mx-auto rounded shadow-sm"
                />
              )}
              {previewKind === "video" && (
                <video
                  src={viewUrl}
                  controls
                  className="max-w-full max-h-[55vh] mx-auto rounded"
                />
              )}
              {previewKind === "audio" && (
                <audio src={viewUrl} controls className="w-full mt-4" />
              )}
              {previewKind === "pdf" && (
                <iframe
                  src={viewUrl}
                  className="w-full h-[60vh] rounded border border-base-300"
                  title={fileName}
                />
              )}
              {previewKind === "markdown" && (
                <div className="text-sm">
                  {textLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="animate-spin" size={20} />
                    </div>
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{textContent || ""}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
              {previewKind === "text" && (
                <>
                  {textLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="animate-spin" size={20} />
                    </div>
                  ) : (
                    <pre className="text-xs bg-base-200 p-3 rounded overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                      {textContent}
                    </pre>
                  )}
                </>
              )}
              {previewKind === "binary" && (
                <div className="text-center py-12 text-base-content/60">
                  <FileIcon size={56} className="mx-auto mb-3 opacity-50" />
                  <p>Inline preview not available.</p>
                  <p className="text-xs mt-1 font-mono">
                    {mimeType || "application/octet-stream"}
                  </p>
                  <button
                    type="button"
                    onClick={() => setViewMode("hex")}
                    className="mt-3 inline-flex items-center gap-1.5 h-8 px-2.5 text-xs rounded-gw-sm border border-hairline hover:bg-base-200"
                  >
                    <Hash size={12} /> Inspect as hex
                  </button>
                </div>
              )}
            </>
          )}

          {/* Properties */}
          <div className="mt-6 border-t border-base-300 pt-3 space-y-5">
            <section>
              <h4 className="font-medium mb-2 text-xs uppercase tracking-wide text-base-content/70">
                Properties
              </h4>
              {metaLoading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <dl className="text-xs space-y-1.5">
                  <Row label="Size" value={readableBytes(object.size)} />
                  <Row
                    label="Modified"
                    value={dayjs(object.lastModified).format(
                      "YYYY-MM-DD HH:mm:ss"
                    )}
                  />
                  <Row
                    label="Content-Type"
                    value={meta?.ContentType || mimeType || "—"}
                    mono
                  />
                  {meta?.ETag && (
                    <Row
                      label="ETag"
                      value={meta.ETag.replace(/"/g, "")}
                      mono
                    />
                  )}
                  {meta?.Metadata && Object.keys(meta.Metadata).length > 0 && (
                    <div className="mt-3 pt-2 border-t border-base-200">
                      <p className="text-base-content/60 mb-1 font-medium">
                        User Metadata
                      </p>
                      {Object.entries(meta.Metadata).map(([k, v]) => (
                        <Row key={k} label={k} value={v} mono />
                      ))}
                    </div>
                  )}
                </dl>
              )}
            </section>

            {/* Storage / Replication */}
            <section>
              <h4 className="font-medium mb-2 text-xs uppercase tracking-wide text-base-content/70 flex items-center gap-1.5">
                <HardDrive size={12} /> Storage
              </h4>
              <dl className="text-xs space-y-1.5">
                <Row label="Bucket" value={bucketName} mono />
                <Row label="Object Key" value={fullKey} mono />
                <Row
                  label="Replication"
                  value="Distributed across cluster (per layout)"
                />
              </dl>
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

const HexView = ({
  bytes,
  loading,
  truncated,
  totalSize,
}: {
  bytes: Uint8Array | null;
  loading: boolean;
  truncated: boolean;
  totalSize?: number;
}) => {
  const rows = useMemo(() => {
    if (!bytes) return [];
    const out: { offset: number; hex: string; ascii: string }[] = [];
    for (let i = 0; i < bytes.length; i += 16) {
      const slice = bytes.subarray(i, Math.min(i + 16, bytes.length));
      const hex = Array.from(slice)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");
      const ascii = Array.from(slice)
        .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : "."))
        .join("");
      out.push({ offset: i, hex, ascii });
    }
    return out;
  }, [bytes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }
  if (!bytes || bytes.length === 0) {
    return (
      <p className="text-sm text-base-content/60 text-center py-8">
        No content to inspect.
      </p>
    );
  }

  return (
    <div className="text-[11px] font-mono leading-relaxed bg-base-200 rounded p-3 overflow-x-auto">
      {truncated && (
        <div className="mb-2 px-2 py-1.5 rounded bg-warning/10 border border-warning/30 text-warning text-[11px]">
          Showing first {readableBytes(bytes.length)} of{" "}
          {readableBytes(totalSize || 0)}. Use Download for the full object.
        </div>
      )}
      <table className="w-full">
        <tbody>
          {rows.map((row) => (
            <tr key={row.offset}>
              <td className="pr-3 text-base-content/40 select-none whitespace-nowrap">
                {row.offset.toString(16).padStart(8, "0")}
              </td>
              <td className="pr-3 whitespace-pre text-base-content/80">
                {row.hex.padEnd(47, " ")}
              </td>
              <td className="text-base-content/60 whitespace-pre">
                {row.ascii}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Row = ({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) => (
  <div className="flex justify-between gap-3">
    <dt className="text-base-content/60 shrink-0">{label}</dt>
    <dd
      className={`text-right truncate ${
        mono ? "font-mono text-[11px]" : ""
      }`}
      title={value}
    >
      {value}
    </dd>
  </div>
);

export default PreviewDrawer;
