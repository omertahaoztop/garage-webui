import { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import transferStore from "@/stores/transfer-store";
import { uploadAuto } from "./hooks";
import { useQueryClient } from "@tanstack/react-query";

const MAX_PARALLEL = 3;

type Props = {
  bucket: string;
  prefix: string;
};

/**
 * UploadZone is a full-page drag-and-drop overlay. It listens for files
 * dragged from the OS into the browser window and dispatches each one to the
 * transfer queue. A small concurrency limiter (MAX_PARALLEL) keeps too many
 * XHRs from flooding a single Garage node.
 */
const UploadZone = ({ bucket, prefix }: Props) => {
  const queryClient = useQueryClient();
  const [dragVisible, setDragVisible] = useState(false);
  const dragCounter = useRef(0);

  const enqueue = useCallback(
    (files: File[]) => {
      for (const file of files) {
        const key = prefix + file.name;
        const abort = new AbortController();
        const id = transferStore.add({ bucket, key, file, abort });
        runUpload(id, bucket, key, file, abort.signal, () => {
          queryClient.invalidateQueries({ queryKey: ["browse", bucket] });
        });
      }
    },
    [bucket, prefix, queryClient]
  );

  // dropzone for actual drop events on the surface
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => enqueue(accepted),
    noClick: true, // no click-to-open on the overlay itself
    noKeyboard: true,
    multiple: true,
  });

  // Window-level dragenter/leave so the overlay reveals BEFORE the dropzone
  // gets the event. This is the MinIO Console pattern: an idle invisible
  // overlay that becomes visible only when the user starts dragging files in.
  useEffect(() => {
    const onEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      dragCounter.current += 1;
      setDragVisible(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      dragCounter.current = Math.max(0, dragCounter.current - 1);
      if (dragCounter.current === 0) setDragVisible(false);
    };
    const onDrop = () => {
      dragCounter.current = 0;
      setDragVisible(false);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  if (!dragVisible) return null;

  return (
    <div
      {...getRootProps()}
      className={cn(
        "fixed inset-0 z-40 flex items-center justify-center",
        "bg-base-100/85 backdrop-blur-sm transition-opacity",
        isDragActive ? "border-primary" : "border-base-content/20"
      )}
    >
      <input {...getInputProps()} />
      <div
        className={cn(
          "rounded-xl border-2 border-dashed p-12 text-center",
          "bg-base-200/80 shadow-xl",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-base-content/30"
        )}
      >
        <UploadCloud
          size={64}
          className={cn(
            "mx-auto mb-4",
            isDragActive ? "text-primary" : "text-base-content/40"
          )}
        />
        <h3 className="text-xl font-semibold">
          {isDragActive ? "Release to upload" : "Drop files here"}
        </h3>
        <p className="mt-2 text-sm text-base-content/60">
          They will be uploaded to <code className="font-mono">{prefix || "/"}</code>
        </p>
      </div>
    </div>
  );
};

// Simple concurrency limiter — kicked off via runUpload below.
let active = 0;
const pending: Array<() => void> = [];

const runUpload = (
  id: string,
  bucket: string,
  key: string,
  file: File,
  signal: AbortSignal,
  onDone: () => void
) => {
  const exec = async () => {
    transferStore.setStatus(id, "uploading");
    try {
      await uploadAuto({
        bucket,
        key,
        file,
        signal,
        onProgress: (p) => transferStore.setProgress(id, p),
      });
      transferStore.setProgress(id, 1);
      transferStore.setStatus(id, "done");
      onDone();
    } catch (err: unknown) {
      if (signal.aborted) {
        transferStore.setStatus(id, "cancelled");
      } else {
        const msg =
          err instanceof Error ? err.message : "Unknown upload error";
        transferStore.setStatus(id, "error", { error: msg });
      }
    } finally {
      active -= 1;
      const next = pending.shift();
      if (next) next();
    }
  };

  if (active < MAX_PARALLEL) {
    active += 1;
    exec();
  } else {
    pending.push(() => {
      active += 1;
      exec();
    });
  }
};

export default UploadZone;
