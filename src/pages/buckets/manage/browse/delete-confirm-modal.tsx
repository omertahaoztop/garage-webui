import { AlertTriangle, Loader2 } from "lucide-react";
import { Modal } from "react-daisyui";
import Button from "@/components/ui/button";

type Props = {
  open: boolean;
  title: string;
  description: string;
  count?: number;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const DeleteConfirmModal = ({
  open,
  title,
  description,
  count,
  isPending,
  onConfirm,
  onCancel,
}: Props) => {
  return (
    <Modal open={open} backdrop>
      <Modal.Header className="flex items-center gap-2">
        <AlertTriangle className="text-warning" size={22} />
        {title}
      </Modal.Header>
      <Modal.Body>
        <p>{description}</p>
        {count !== undefined && count > 1 && (
          <p className="mt-2 text-sm text-base-content/60">
            {count} items will be permanently deleted. This cannot be undone.
          </p>
        )}
      </Modal.Body>
      <Modal.Actions>
        <Button onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button
          color="error"
          onClick={onConfirm}
          disabled={isPending}
          className="gap-1.5"
        >
          {isPending && <Loader2 className="animate-spin" size={16} />}
          Delete
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default DeleteConfirmModal;
