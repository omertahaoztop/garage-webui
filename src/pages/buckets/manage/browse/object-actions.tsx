import { useState } from "react";
import { Dropdown } from "react-daisyui";
import {
  Copy as CopyIcon,
  DownloadIcon,
  EllipsisVertical,
  Link2,
  MoveIcon,
  Share2,
  Trash,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import Button from "@/components/ui/button";
import { handleError } from "@/lib/utils";
import { API_URL } from "@/lib/api";
import { useBucketContext } from "../context";
import { useDeleteObject } from "./hooks";
import { presignDialog } from "./presign-dialog";
import { shareDialog } from "./share-dialog";
import { copyMoveDialog } from "./copy-move-dialog";
import DeleteConfirmModal from "./delete-confirm-modal";
import { BrowserObject } from "./types";

type Props = {
  prefix?: string;
  object: Pick<BrowserObject, "objectKey" | "url">;
};

const ObjectActions = ({ prefix = "", object }: Props) => {
  const { bucket, bucketName } = useBucketContext();
  const queryClient = useQueryClient();
  const isDirectory = object.objectKey.endsWith("/");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const deleteObject = useDeleteObject(bucketName, {
    onSuccess: () => {
      toast.success("Object deleted");
      queryClient.invalidateQueries({ queryKey: ["browse", bucketName] });
      setConfirmOpen(false);
    },
    onError: (e) => {
      handleError(e);
      setConfirmOpen(false);
    },
  });

  const onDownload = () => {
    window.open(API_URL + object.url + "?dl=1", "_blank");
  };

  const onPresign = () => {
    presignDialog.open({ key: prefix + object.objectKey });
  };

  // Legacy bucket-website share — only relevant when website access is enabled.
  const onWebsiteShare = () => {
    shareDialog.open({ key: object.objectKey, prefix });
  };

  const onCopy = () => {
    copyMoveDialog.open({ key: object.objectKey, prefix, mode: "copy" });
  };

  const onMove = () => {
    copyMoveDialog.open({ key: object.objectKey, prefix, mode: "move" });
  };

  const onDelete = () => {
    setConfirmOpen(true);
  };

  const onConfirmDelete = () => {
    deleteObject.mutate({
      key: prefix + object.objectKey,
      recursive: isDirectory,
    });
  };

  return (
    <span
      className="flex flex-row items-center gap-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      {!isDirectory && (
        <Button
          icon={DownloadIcon}
          color="ghost"
          size="sm"
          shape="circle"
          onClick={onDownload}
          title="Download"
        />
      )}

      <Dropdown end>
        <Dropdown.Toggle button={false}>
          <Button
            icon={EllipsisVertical}
            color="ghost"
            size="sm"
            shape="circle"
            title="More actions"
          />
        </Dropdown.Toggle>

        <Dropdown.Menu className="gap-y-1 min-w-[180px] z-30">
          {!isDirectory && (
            <Dropdown.Item onClick={onPresign}>
              <Link2 size={16} /> Share via link
            </Dropdown.Item>
          )}
          {!isDirectory && bucket?.websiteAccess && (
            <Dropdown.Item onClick={onWebsiteShare}>
              <Share2 size={16} /> Public website URL
            </Dropdown.Item>
          )}
          {!isDirectory && (
            <Dropdown.Item onClick={onCopy}>
              <CopyIcon size={16} /> Copy to…
            </Dropdown.Item>
          )}
          {!isDirectory && (
            <Dropdown.Item onClick={onMove}>
              <MoveIcon size={16} /> Move to…
            </Dropdown.Item>
          )}
          <Dropdown.Item
            className="text-error bg-error/10 hover:bg-error/20"
            onClick={onDelete}
          >
            <Trash size={16} /> Delete
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>

      <DeleteConfirmModal
        open={confirmOpen}
        title={`Delete ${isDirectory ? "folder" : "object"}?`}
        description={`Are you sure you want to delete "${object.objectKey}"?${
          isDirectory ? " All contents will be removed." : ""
        }`}
        isPending={deleteObject.isPending}
        onConfirm={onConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </span>
  );
};

export default ObjectActions;
