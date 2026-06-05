import { createStore, useStore as useZustandStore } from "zustand";

/**
 * Transfer represents a single in-flight (or completed) upload that the UI
 * can render progress for. Cancellation is wired through an AbortController
 * so we can hard-stop an XHR upload mid-stream.
 */
export type TransferStatus =
  | "queued"
  | "uploading"
  | "done"
  | "error"
  | "cancelled";

export interface Transfer {
  id: string;
  bucket: string;
  key: string;
  fileName: string;
  fileSize: number;
  status: TransferStatus;
  progress: number; // 0..1
  error?: string;
  startedAt?: number;
  finishedAt?: number;
  abort?: AbortController;
}

interface TransferState {
  transfers: Transfer[];
}

const store = createStore<TransferState>(() => ({ transfers: [] }));

let _id = 0;
const nextId = () => `t-${Date.now()}-${++_id}`;

const transferStore = {
  ...store,
  /** Add a new transfer to the queue and return its id. */
  add: (input: {
    bucket: string;
    key: string;
    file: File;
    abort?: AbortController;
  }) => {
    const t: Transfer = {
      id: nextId(),
      bucket: input.bucket,
      key: input.key,
      fileName: input.file.name,
      fileSize: input.file.size,
      status: "queued",
      progress: 0,
      abort: input.abort,
    };
    store.setState((s) => ({ transfers: [...s.transfers, t] }));
    return t.id;
  },
  setStatus: (
    id: string,
    status: TransferStatus,
    extra?: { error?: string }
  ) => {
    store.setState((s) => ({
      transfers: s.transfers.map((t) =>
        t.id === id
          ? {
              ...t,
              status,
              error: extra?.error,
              startedAt: status === "uploading" ? Date.now() : t.startedAt,
              finishedAt:
                status === "done" ||
                status === "error" ||
                status === "cancelled"
                  ? Date.now()
                  : t.finishedAt,
            }
          : t
      ),
    }));
  },
  setProgress: (id: string, progress: number) => {
    store.setState((s) => ({
      transfers: s.transfers.map((t) =>
        t.id === id ? { ...t, progress } : t
      ),
    }));
  },
  cancel: (id: string) => {
    const t = store.getState().transfers.find((x) => x.id === id);
    t?.abort?.abort();
    transferStore.setStatus(id, "cancelled");
  },
  remove: (id: string) => {
    store.setState((s) => ({
      transfers: s.transfers.filter((t) => t.id !== id),
    }));
  },
  clearFinished: () => {
    store.setState((s) => ({
      transfers: s.transfers.filter(
        (t) =>
          t.status !== "done" &&
          t.status !== "error" &&
          t.status !== "cancelled"
      ),
    }));
  },
  /** React hook returning a slice of state. */
  useStore: <T>(selector: (s: TransferState) => T) =>
    useZustandStore(store, selector),
};

export default transferStore;
