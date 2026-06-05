import { useEffect, useState } from "react";
import { Modal } from "react-daisyui";
import { Copy, Globe, Link2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { createDisclosure } from "@/lib/disclosure";
import { copyToClipboard } from "@/lib/utils";
import { useCreateShareToken, usePresignUrl } from "./hooks";
import { useBucketContext } from "../context";

// presignDialog is intentionally kept under the same disclosure name so
// every caller (object-actions, preview-drawer, copy-move) stays unchanged.
// The dialog body switches between "S3 Presigned URL" (signed AWS URL,
// served by Garage directly — no webui hop) and "Web Share Link" (HMAC
// token verified by /api/share/<token>, streamed through webui).
export const presignDialog = createDisclosure<{ key: string }>();

type ShareMode = "presign" | "webshare";

const EXPIRY_PRESETS = [
  { label: "1 hour", seconds: 3600 },
  { label: "24 hours", seconds: 86400 },
  { label: "7 days (max)", seconds: 604800 },
];

const PresignDialog = () => {
  const { isOpen, data, dialogRef } = presignDialog.use();
  const { bucketName } = useBucketContext();
  const [mode, setMode] = useState<ShareMode>("presign");
  const [expires, setExpires] = useState(3600);
  const [url, setUrl] = useState("");

  const presign = usePresignUrl(bucketName, {
    onSuccess: (result) => setUrl(result.url),
    onError: (e) => toast.error(e.message),
  });

  // Web Share: backend returns a relative /api/share/<token>; we surface
  // the absolute URL by prepending window.location.origin so the user can
  // copy a directly-clickable link.
  const webshare = useCreateShareToken(bucketName, {
    onSuccess: (result) => {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      setUrl(origin + result.url);
    },
    onError: (e) => toast.error(e.message),
  });

  const pending = presign.isPending || webshare.isPending;

  // Reset both URL and mode-specific state every time the dialog opens
  // (or the underlying key changes — e.g. user re-opens for a different obj).
  useEffect(() => {
    if (!isOpen) {
      setUrl("");
      setExpires(3600);
      setMode("presign");
    }
  }, [isOpen, data?.key]);

  const onGenerate = () => {
    if (!data?.key) return;
    if (mode === "presign") {
      presign.mutate({ key: data.key, expires });
    } else {
      webshare.mutate({ key: data.key, expires });
    }
  };

  const onCopy = () => copyToClipboard(url);

  // Switching mode invalidates the previously-generated URL so the user
  // doesn't accidentally copy the wrong kind of link.
  const onModeChange = (next: ShareMode) => {
    if (next !== mode) {
      setMode(next);
      setUrl("");
    }
  };

  return (
    <Modal ref={dialogRef} open={isOpen} backdrop>
      <Modal.Header className="flex items-center gap-2 truncate">
        <Link2 size={18} />
        Share Link
      </Modal.Header>
      <Modal.Body>
        <p className="text-sm text-base-content/70 mb-3 truncate font-mono">
          {data?.key || ""}
        </p>

        {/* Mode toggle: S3 Presigned URL vs Web Share Link. */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => onModeChange("presign")}
            className={`btn btn-sm normal-case gap-2 ${
              mode === "presign" ? "btn-primary" : "btn-ghost"
            }`}
          >
            <ShieldCheck size={14} />
            S3 Presigned
          </button>
          <button
            onClick={() => onModeChange("webshare")}
            className={`btn btn-sm normal-case gap-2 ${
              mode === "webshare" ? "btn-primary" : "btn-ghost"
            }`}
          >
            <Globe size={14} />
            Web Share
          </button>
        </div>

        {/* Short mode hint to set the right expectation. */}
        <p className="text-xs text-base-content/60 mb-3">
          {mode === "presign"
            ? "AWS SigV4 link served directly by Garage. No metadata stripping, downloads only."
            : "Tokenized link served through the webui. Renders inline for viewable types; deny-list other extensions."}
        </p>

        <div className="form-control mb-3">
          <label className="label py-1">
            <span className="label-text text-sm">Expires after</span>
          </label>
          <div className="flex gap-2">
            {EXPIRY_PRESETS.map((p) => (
              <button
                key={p.seconds}
                onClick={() => {
                  setExpires(p.seconds);
                  setUrl("");
                }}
                className={`btn btn-sm flex-1 normal-case ${
                  expires === p.seconds ? "btn-primary" : "btn-ghost"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {url ? (
          <div className="relative mt-3">
            <Input
              value={url}
              readOnly
              className="w-full pr-12 font-mono text-xs"
              onFocus={(e) => e.target.select()}
            />
            <Button
              icon={Copy}
              onClick={onCopy}
              className="absolute top-0 right-0"
              color="ghost"
              title="Copy"
            />
          </div>
        ) : (
          <Button
            onClick={onGenerate}
            color="primary"
            disabled={pending}
            className="w-full gap-2"
          >
            {pending && <Loader2 className="animate-spin" size={16} />}
            Generate URL
          </Button>
        )}

        {url && (
          <p className="text-xs text-base-content/60 mt-2">
            Anyone with this link can access the object until it expires.
          </p>
        )}
      </Modal.Body>
      <Modal.Actions>
        <Button onClick={() => presignDialog.close()}>Close</Button>
      </Modal.Actions>
    </Modal>
  );
};

export default PresignDialog;
