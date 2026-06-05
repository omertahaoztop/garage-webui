import { Loader2, Trash2, X } from "lucide-react";
import Button from "@/components/ui/button";

type Props = {
  count: number;
  onDelete: () => void;
  onClear: () => void;
  isDeleting?: boolean;
};

const BulkActionBar = ({ count, onDelete, onClear, isDeleting }: Props) => {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 bg-base-100 border border-base-300 shadow-2xl rounded-full px-2 py-2 flex items-center gap-2 backdrop-blur-md">
      <span className="text-sm font-medium px-3 py-1">
        {count} selected
      </span>
      <div className="w-px h-6 bg-base-300" />
      <Button
        size="sm"
        color="error"
        onClick={onDelete}
        disabled={isDeleting}
        className="gap-1.5"
      >
        {isDeleting ? (
          <Loader2 className="animate-spin" size={16} />
        ) : (
          <Trash2 size={16} />
        )}
        Delete
      </Button>
      <Button
        icon={X}
        size="sm"
        color="ghost"
        shape="circle"
        onClick={onClear}
        title="Clear selection"
      />
    </div>
  );
};

export default BulkActionBar;
