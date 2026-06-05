import { createDisclosure } from "@/lib/disclosure";
import { Modal } from "react-daisyui";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Copy as CopyIcon, MoveIcon } from "lucide-react";
import { toast } from "sonner";
import { useCopyObject } from "./hooks";
import { useBucketContext } from "../context";
import { useBuckets } from "@/pages/buckets/hooks";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { handleError } from "@/lib/utils";

export type CopyMoveData = {
  // Object key relative to the current prefix (filename only).
  key: string;
  // Prefix currently being browsed.
  prefix?: string;
  // 'copy' = leave source intact; 'move' = delete source after copy.
  mode: "copy" | "move";
};

/**
 * copyMoveDialog drives the Copy/Move modal via createDisclosure so
 * object-actions (per-row dropdown) can open it without prop-drilling.
 *
 * Both copy and move share the same dialog UI; the only difference is the
 * `deleteSource` flag sent to the backend and the label.
 */
export const copyMoveDialog = createDisclosure<CopyMoveData>();

const CopyMoveDialog = () => {
  const { isOpen, data, dialogRef } = copyMoveDialog.use();
  const { bucketName } = useBucketContext();
  const { data: buckets } = useBuckets();
  const queryClient = useQueryClient();

  const [dstBucket, setDstBucket] = useState(bucketName);
  const [dstKey, setDstKey] = useState("");

  const mode = data?.mode ?? "copy";
  const isMove = mode === "move";
  const srcKey = (data?.prefix ?? "") + (data?.key ?? "");

  // Reset state every time the dialog opens with new data so the user
  // gets a clean target prefilled with the source key (common pattern).
  useEffect(() => {
    if (isOpen) {
      setDstBucket(bucketName);
      setDstKey(srcKey);
    }
  }, [isOpen, bucketName, srcKey]);

  const copy = useCopyObject(bucketName, {
    onSuccess: () => {
      toast.success(isMove ? "Object moved" : "Object copied");
      queryClient.invalidateQueries({ queryKey: ["browse", bucketName] });
      if (dstBucket !== bucketName) {
        queryClient.invalidateQueries({ queryKey: ["browse", dstBucket] });
      }
      // Bucket totals change when an object leaves/enters a bucket.
      queryClient.invalidateQueries({ queryKey: ["buckets"] });
      copyMoveDialog.close();
    },
    onError: handleError,
  });

  const onSubmit = () => {
    if (!dstKey.trim() || !dstBucket) {
      toast.error("Destination key and bucket are required");
      return;
    }
    if (dstBucket === bucketName && dstKey === srcKey) {
      toast.error("Destination must differ from source");
      return;
    }
    copy.mutate({
      srcKey,
      dstKey,
      dstBucket,
      deleteSource: isMove,
    });
  };

  const accessibleBuckets = (buckets ?? [])
    .flatMap((b) => b.globalAliases ?? [])
    .filter((x): x is string => typeof x === "string" && x.length > 0);

  // Fallback: ensure the current bucket is always selectable even if the
  // /api/buckets cache hasn't populated yet.
  const bucketOptions = Array.from(
    new Set<string>([bucketName, ...accessibleBuckets])
  );

  return (
    <Modal ref={dialogRef} open={isOpen} backdrop>
      <Modal.Header className="font-bold flex items-center gap-2">
        {isMove ? <MoveIcon className="w-5 h-5" /> : <CopyIcon className="w-5 h-5" />}
        {isMove ? "Move" : "Copy"} object
      </Modal.Header>
      <Modal.Body>
        <div className="flex flex-col gap-3">
          <div className="text-sm text-base-content/60">Source</div>
          <div className="font-mono text-sm break-all p-2 bg-base-200 rounded">
            <span className="text-base-content/60">{bucketName}/</span>
            {srcKey || <em className="text-base-content/40">(empty)</em>}
          </div>

          <div className="flex items-center justify-center text-base-content/40 py-1">
            <ArrowRight className="w-5 h-5" />
          </div>

          <div className="text-sm text-base-content/60">Destination</div>
          <div className="flex gap-2">
            <select
              className="select select-bordered w-1/3 max-w-[180px]"
              value={dstBucket}
              onChange={(e) => setDstBucket(e.target.value)}
              aria-label="Destination bucket"
            >
              {bucketOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <Input
              value={dstKey}
              onChange={(e) => setDstKey(e.target.value)}
              placeholder="path/to/key"
              className="flex-1"
              aria-label="Destination key"
            />
          </div>

          {isMove && (
            <div className="text-xs text-warning leading-relaxed">
              Move = copy + delete source. If the copy fails, the source is
              preserved. If the delete fails after a successful copy, you may
              end up with a duplicate that needs manual cleanup.
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Actions>
        <Button onClick={close} disabled={copy.isPending}>
          Cancel
        </Button>
        <Button color="primary" onClick={onSubmit} disabled={copy.isPending}>
          {copy.isPending ? "Working…" : isMove ? "Move" : "Copy"}
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default CopyMoveDialog;
