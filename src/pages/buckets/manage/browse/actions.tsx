import { FolderPlus, FolderUp, UploadIcon } from "lucide-react";
import Button from "@/components/ui/button";
import { uploadAuto, usePutObject } from "./hooks";
import { toast } from "sonner";
import { handleError } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useBucketContext } from "../context";
import { useDisclosure } from "@/hooks/useDisclosure";
import { Modal } from "react-daisyui";
import { createFolderSchema, CreateFolderSchema } from "./schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputField } from "@/components/ui/input";
import { useEffect } from "react";
import transferStore from "@/stores/transfer-store";

type Props = {
  prefix: string;
};

const MAX_PARALLEL = 3;

/**
 * Actions hosts the toolbar entries above the object list: Create Folder
 * (still modal-based), and Upload File. Upload no longer streams through a
 * blocking useMutation — every selected file is enqueued into the global
 * transfer store, so the user can keep browsing while uploads run in the
 * background. Drag-and-drop is handled by UploadZone mounted at the page
 * level.
 */
const Actions = ({ prefix }: Props) => {
  const { bucketName } = useBucketContext();
  const queryClient = useQueryClient();

  // `useFolderRelative=true` preserves the relative directory structure of
  // folder uploads via the webkitRelativePath attribute (e.g. "docs/img/a.png"
  // becomes the S3 key suffix). Browser support: Chrome/Edge/Safari; Firefox
  // exposes it too but the picker UI differs slightly.
  const enqueue = (files: FileList | File[], useFolderRelative = false) => {
    const arr = Array.from(files);
    for (const file of arr) {
      // For folder uploads, webkitRelativePath gives the in-tree path. For
      // regular uploads it's empty, so we fall back to the bare filename.
      const relName =
        useFolderRelative && (file as File & { webkitRelativePath?: string })
          .webkitRelativePath
          ? (file as File & { webkitRelativePath: string }).webkitRelativePath
          : file.name;
      const key = prefix + relName;
      const abort = new AbortController();
      const id = transferStore.add({ bucket: bucketName, key, file, abort });
      run(id, bucketName, key, file, abort.signal, () =>
        queryClient.invalidateQueries({ queryKey: ["browse", bucketName] })
      );
    }
  };

  const onUploadFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files?.length) enqueue(files, false);
    };
    input.click();
    input.remove();
  };

  // Folder upload uses the non-standard webkitdirectory attribute. We set it
  // imperatively because TS doesn't have a declarative prop for it on
  // HTMLInputElement. All major browsers support it (per MDN).
  const onUploadFolder = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (input as any).webkitdirectory = true;
    (input as HTMLInputElement).setAttribute("webkitdirectory", "");
    (input as HTMLInputElement).setAttribute("directory", "");
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files?.length) enqueue(files, true);
    };
    input.click();
    input.remove();
  };

  return (
    <>
      <CreateFolderAction prefix={prefix} />
      <Button
        color="ghost"
        onClick={onUploadFile}
        title="Upload File"
        className="gap-1.5"
      >
        <UploadIcon size={14} />
        <span className="hidden sm:inline">Upload</span>
      </Button>
      <Button
        color="ghost"
        onClick={onUploadFolder}
        title="Upload Folder"
        className="gap-1.5"
      >
        <FolderUp size={14} />
        <span className="hidden md:inline">Folder</span>
      </Button>
    </>
  );
};

// Shared concurrency limiter for the upload pool. Mirrors the one in
// upload-zone.tsx — both producers feed the same MAX_PARALLEL pool.
let active = 0;
const pending: Array<() => void> = [];

const run = (
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

type CreateFolderActionProps = {
  prefix: string;
};

const CreateFolderAction = ({ prefix }: CreateFolderActionProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { bucketName } = useBucketContext();
  const queryClient = useQueryClient();

  const form = useForm<CreateFolderSchema>({
    resolver: zodResolver(createFolderSchema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (isOpen) form.setFocus("name");
  }, [isOpen]);

  const createFolder = usePutObject(bucketName, {
    onSuccess: () => {
      toast.success("Folder created!");
      queryClient.invalidateQueries({ queryKey: ["browse", bucketName] });
      onClose();
      form.reset();
    },
    onError: handleError,
  });

  const onSubmit = form.handleSubmit((values) => {
    createFolder.mutate({ key: `${prefix}${values.name}/`, file: null });
  });

  return (
    <>
      <Button
        icon={FolderPlus}
        color="ghost"
        onClick={onOpen}
        title="Create Folder"
      />

      <Modal open={isOpen}>
        <Modal.Header>Create Folder</Modal.Header>

        <Modal.Body>
          <form onSubmit={onSubmit}>
            <InputField form={form} name="name" title="Name" />
          </form>
        </Modal.Body>

        <Modal.Actions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            color="primary"
            onClick={onSubmit}
            disabled={createFolder.isPending}
          >
            Submit
          </Button>
        </Modal.Actions>
      </Modal>
    </>
  );
};

export default Actions;
