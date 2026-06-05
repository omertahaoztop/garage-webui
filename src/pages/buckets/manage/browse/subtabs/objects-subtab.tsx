import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "react-daisyui";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { handleError } from "@/lib/utils";
import { useBucketContext } from "../../context";
import Actions from "../actions";
import BulkActionBar from "../bulk-action-bar";
import DeleteConfirmModal from "../delete-confirm-modal";
import ObjectList from "../object-list";
import ObjectListNavigator from "../object-list-navigator";
import { defaultFilterState, FilterState } from "../filter-panel";
import { presignDialog } from "../presign-dialog";
import PreviewDrawer from "../preview-drawer";
import UploadZone from "../upload-zone";
import { useBulkDelete } from "../hooks";
import { BrowserObject } from "../types";

const getInitialPrefixes = (searchParams: URLSearchParams) => {
  const prefix = searchParams.get("prefix");
  if (prefix) {
    const paths = prefix.split("/").filter((p) => p);
    return paths.map((_, i) => paths.slice(0, i + 1).join("/") + "/");
  }
  return [];
};

/**
 * ObjectsSubTab owns the per-prefix listing UI extracted from the legacy
 * browse-tab monolith. State (prefix history, search, filter, selection,
 * preview, bulk-confirm) lives here so other sub-tabs (Sharing/Keys) can
 * mount independently without re-rendering the list on every keystroke.
 */
const ObjectsSubTab = () => {
  const { bucket, bucketName } = useBucketContext();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [prefixHistory, setPrefixHistory] = useState<string[]>(
    getInitialPrefixes(searchParams)
  );
  const [curPrefix, setCurPrefix] = useState(prefixHistory.length - 1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterState, setFilterState] = useState<FilterState>(defaultFilterState);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [previewObject, setPreviewObject] = useState<BrowserObject | null>(
    null
  );
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const prefix = prefixHistory[curPrefix] || "";

  // Sync prefix to URL so back/forward + page reload preserve location.
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("prefix", prefix);
    setSearchParams(newParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curPrefix]);

  // Clear selection whenever the user navigates into a different folder.
  useEffect(() => {
    setSelectedKeys(new Set());
  }, [prefix]);

  // Debounce search input for 200ms so typing doesn't trigger a re-filter
  // on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const gotoPrefix = (p: string) => {
    const history = prefixHistory.slice(0, curPrefix + 1);
    setPrefixHistory([...history, p]);
    setCurPrefix(history.length);
  };

  const bulkDelete = useBulkDelete(bucketName, {
    onSuccess: (res) => {
      const okCount = res.deleted.length;
      const errCount = res.errors.length;
      if (okCount > 0) {
        toast.success(
          `Deleted ${okCount} object${okCount === 1 ? "" : "s"}`
        );
      }
      if (errCount > 0) {
        toast.error(
          `${errCount} object${errCount === 1 ? "" : "s"} failed: ${
            res.errors[0].message
          }`
        );
      }
      queryClient.invalidateQueries({ queryKey: ["browse", bucketName] });
      setSelectedKeys(new Set());
      setBulkConfirmOpen(false);
    },
    onError: (e) => {
      handleError(e);
      setBulkConfirmOpen(false);
    },
  });

  // Bucket needs a read+write key for browsing to work.
  if (!bucket.keys.find((k) => k.permissions.read && k.permissions.write)) {
    return (
      <div className="p-4 min-h-[200px] flex flex-col items-center justify-center">
        <p className="text-center max-w-sm">
          You need to add a key with read &amp; write access to your bucket to
          be able to browse it.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="pb-0 overflow-hidden">
        <ObjectListNavigator
          curPrefix={curPrefix}
          setCurPrefix={setCurPrefix}
          prefixHistory={prefixHistory}
          actions={<Actions prefix={prefix} />}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterState={filterState}
          onFilterChange={setFilterState}
        />

        <ObjectList
          prefix={prefix}
          onPrefixChange={gotoPrefix}
          searchQuery={debouncedSearch}
          filterState={filterState}
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          onObjectPreview={setPreviewObject}
        />
      </Card>

      <BulkActionBar
        count={selectedKeys.size}
        isDeleting={bulkDelete.isPending}
        onDelete={() => setBulkConfirmOpen(true)}
        onClear={() => setSelectedKeys(new Set())}
      />

      <DeleteConfirmModal
        open={bulkConfirmOpen}
        title="Delete selected objects?"
        description="This action cannot be undone."
        count={selectedKeys.size}
        isPending={bulkDelete.isPending}
        onConfirm={() =>
          bulkDelete.mutate(
            Array.from(selectedKeys).map((k) => prefix + k)
          )
        }
        onCancel={() => setBulkConfirmOpen(false)}
      />

      <PreviewDrawer
        open={!!previewObject}
        object={previewObject || undefined}
        prefix={prefix}
        onClose={() => setPreviewObject(null)}
        onShare={(o) =>
          presignDialog.open({ key: prefix + o.objectKey })
        }
      />

      {/* Drag-drop overlay is scoped to the Objects sub-tab so files
          dragged into the window while Sharing/Keys is active don't try
          to upload. TransferQueue stays at the shell level so in-flight
          uploads remain visible regardless of active sub-tab. */}
      <UploadZone bucket={bucketName} prefix={prefix} />
    </div>
  );
};

export default ObjectsSubTab;
