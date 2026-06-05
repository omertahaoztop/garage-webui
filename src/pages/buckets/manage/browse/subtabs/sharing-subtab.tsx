import { useState } from "react";
import { Card } from "react-daisyui";
import { Copy, Link2, Share2, Clock, Globe } from "lucide-react";
import { toast } from "sonner";
import Input from "@/components/ui/input";
import Button from "@/components/ui/button";
import { cn, handleError } from "@/lib/utils";
import { useBucketContext } from "../../context";
import { useCreateShareToken, usePresignUrl } from "../hooks";

type Mode = "presign" | "webshare";

const EXPIRY_PRESETS: Array<{ label: string; seconds: number }> = [
  { label: "1 hour", seconds: 3600 },
  { label: "24 hours", seconds: 86400 },
  { label: "7 days (max)", seconds: 604800 },
];

/**
 * SharingSubTab — bucket-scoped quick share generator. Users paste an
 * object key (or full path) and pick presign vs webshare + expiry. URL
 * appears in a read-only input with a copy button. Separate from the
 * modal-style PresignDialog so power-users can stay on the page while
 * generating multiple URLs for different objects.
 */
const SharingSubTab = () => {
  const { bucketName } = useBucketContext();
  const [objectKey, setObjectKey] = useState("");
  const [mode, setMode] = useState<Mode>("presign");
  const [expires, setExpires] = useState(3600);
  const [generatedUrl, setGeneratedUrl] = useState("");

  const presign = usePresignUrl(bucketName, {
    onError: handleError,
  });
  const webshare = useCreateShareToken(bucketName, {
    onError: handleError,
  });

  const isGenerating = presign.isPending || webshare.isPending;
  const canGenerate = objectKey.trim().length > 0 && !isGenerating;

  const onGenerate = async () => {
    if (!canGenerate) return;
    const key = objectKey.trim();
    try {
      if (mode === "presign") {
        const res = await presign.mutateAsync({ key, expires });
        setGeneratedUrl(res.url);
      } else {
        const res = await webshare.mutateAsync({ key, expires });
        // Token endpoint is relative — prepend window origin so the URL
        // is clickable when pasted into a chat / email.
        setGeneratedUrl(`${window.location.origin}${res.url}`);
      }
    } catch (e) {
      handleError(e);
    }
  };

  const onCopy = async () => {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    toast.success("URL copied to clipboard");
  };

  const onClear = () => {
    setObjectKey("");
    setGeneratedUrl("");
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-hairline flex items-center gap-3">
          <div className="w-10 h-10 rounded-gw-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Share2 size={18} strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-body font-semibold text-fg-primary">
              Quick share
            </h3>
            <p className="text-body-sm text-fg-secondary">
              Generate a time-limited URL for any object in this bucket.
            </p>
          </div>
        </div>

        <div className="px-4 md:px-6 py-5 flex flex-col gap-5">
          {/* Mode toggle: presign (S3 SigV4) vs webshare (HMAC) */}
          <div className="flex flex-col gap-2">
            <label className="text-body-sm font-medium text-fg-primary">
              Share mode
            </label>
            <div className="inline-flex rounded-gw-sm border border-hairline bg-base-200 p-0.5 self-start">
              <ModeButton
                active={mode === "presign"}
                onClick={() => {
                  setMode("presign");
                  setGeneratedUrl("");
                }}
                icon={<Link2 size={14} />}
                label="Presigned URL"
              />
              <ModeButton
                active={mode === "webshare"}
                onClick={() => {
                  setMode("webshare");
                  setGeneratedUrl("");
                }}
                icon={<Globe size={14} />}
                label="Web share"
              />
            </div>
            <p className="text-body-sm text-fg-muted">
              {mode === "presign"
                ? "Direct S3 SigV4 URL — bypasses webui, served by Garage."
                : "Stateless HMAC token routed through webui — supports custom expiry headers."}
            </p>
          </div>

          {/* Object key input */}
          <div className="flex flex-col gap-2">
            <label className="text-body-sm font-medium text-fg-primary">
              Object key
            </label>
            <Input
              value={objectKey}
              onChange={(e) => setObjectKey(e.target.value)}
              placeholder="path/to/object.bin"
              className="font-mono text-body-sm"
            />
            <p className="text-body-sm text-fg-muted">
              Full key including any folder prefix.
            </p>
          </div>

          {/* Expiry select — native <select> is fine here; the /ui/select
              wrapper is react-select which is overkill for a fixed enum. */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="share-expires"
              className="text-body-sm font-medium text-fg-primary"
            >
              Expires after
            </label>
            <select
              id="share-expires"
              value={expires}
              onChange={(e) => setExpires(Number(e.target.value))}
              className="select select-bordered max-w-xs h-10 text-body-sm"
            >
              {EXPIRY_PRESETS.map((p) => (
                <option key={p.seconds} value={p.seconds}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Generate + clear row */}
          <div className="flex items-center gap-2">
            <Button
              color="primary"
              disabled={!canGenerate}
              loading={isGenerating}
              onClick={onGenerate}
              icon={Share2}
            >
              Generate URL
            </Button>
            {(objectKey || generatedUrl) && (
              <Button color="ghost" onClick={onClear}>
                Clear
              </Button>
            )}
          </div>

          {/* Generated URL output */}
          {generatedUrl && (
            <div className="flex flex-col gap-2">
              <label className="text-body-sm font-medium text-fg-primary inline-flex items-center gap-1.5">
                <Clock size={14} className="text-fg-secondary" />
                Generated URL
                <span className="text-fg-muted font-normal">
                  · expires in {expirySummary(expires)}
                </span>
              </label>
              <div className="relative">
                <Input
                  value={generatedUrl}
                  readOnly
                  className="font-mono text-body-sm pr-12"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  onClick={onCopy}
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 right-2",
                    "h-7 w-7 inline-flex items-center justify-center",
                    "rounded-gw-sm text-fg-secondary hover:text-fg-primary",
                    "hover:bg-base-200 transition-colors duration-100"
                  )}
                  title="Copy URL"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Helper card explaining the difference */}
      <Card className="overflow-hidden">
        <div className="px-4 md:px-6 py-4">
          <h3 className="text-body font-semibold text-fg-primary mb-3">
            About share modes
          </h3>
          <dl className="grid gap-3 md:grid-cols-2 text-body-sm">
            <div className="flex flex-col gap-1">
              <dt className="font-medium text-fg-primary inline-flex items-center gap-1.5">
                <Link2 size={14} /> Presigned URL
              </dt>
              <dd className="text-fg-secondary">
                Standard S3 SigV4. URL points directly at the Garage S3
                endpoint. Best for clients that already expect S3 URLs.
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="font-medium text-fg-primary inline-flex items-center gap-1.5">
                <Globe size={14} /> Web share
              </dt>
              <dd className="text-fg-secondary">
                Stateless HMAC token routed via{" "}
                <code className="text-xs">/api/share/&lt;token&gt;</code>.
                Streamed through webui — works behind reverse proxies and
                gives consistent <code className="text-xs">Content-Disposition</code>.
              </dd>
            </div>
          </dl>
        </div>
      </Card>
    </div>
  );
};

const ModeButton = ({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "inline-flex items-center gap-1.5 h-8 px-3 rounded-gw-xs",
      "text-body-sm font-medium transition-colors duration-100",
      active
        ? "bg-base-100 text-fg-primary shadow-sm"
        : "text-fg-secondary hover:text-fg-primary"
    )}
  >
    {icon}
    {label}
  </button>
);

const expirySummary = (seconds: number) => {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} d`;
};

export default SharingSubTab;
