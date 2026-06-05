import { useQueryClient } from "@tanstack/react-query";
import { Box, FolderOpen, Key, RefreshCw, Share2 } from "lucide-react";
import { readableBytes } from "@/lib/utils";
import TabView from "@/components/containers/tab-view";
import { useBucketContext } from "../context";
import CopyMoveDialog from "./copy-move-dialog";
import PresignDialog from "./presign-dialog";
import ShareDialog from "./share-dialog";
import TransferQueue from "./transfer-queue";
import ObjectsSubTab from "./subtabs/objects-subtab";
import SharingSubTab from "./subtabs/sharing-subtab";
import KeysSubTab from "./subtabs/keys-subtab";

/**
 * BrowseTab — shell for the Browse top-level tab. Renders the MinIO-style
 * bucket header (icon + name + meta + refresh) and a 3-way sub-TabView
 * (Objects / Sharing / Keys), then mounts the shared disclosure dialogs
 * + global TransferQueue at the root so they're available regardless of
 * the active sub-tab.
 *
 * UploadZone (full-window drag-drop overlay) lives INSIDE ObjectsSubTab
 * so dropping a file while on Sharing or Keys doesn't try to upload —
 * the user must be on Objects (where the prefix is meaningful) to start
 * an upload by drag.
 */
const BrowseTab = () => {
  const { bucket, bucketName } = useBucketContext();
  const queryClient = useQueryClient();

  const objectsCount = bucket.objects ?? 0;
  const totalBytes = bucket.bytes ?? 0;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["browse", bucketName] });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* MinIO-style bucket header — anchors visual hierarchy so the user
          always knows "where am I" before scanning a sub-tab. */}
      <div className="bg-base-100 rounded-gw-md border border-hairline px-4 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-12 h-12 rounded-gw-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Box size={22} strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-h2 font-semibold tracking-[-0.02em] text-fg-primary truncate">
            {bucketName}
          </h2>
          <p className="text-body-sm text-fg-secondary mt-0.5">
            {objectsCount.toLocaleString()}{" "}
            {objectsCount === 1 ? "object" : "objects"}{" "}
            <span className="text-fg-muted">·</span>{" "}
            {readableBytes(totalBytes)}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="self-start sm:self-auto h-9 px-3 inline-flex items-center gap-2 rounded-gw-sm border border-hairline bg-base-200 hover:bg-base-300 text-fg-secondary hover:text-fg-primary text-body-sm transition-colors duration-100"
          title="Refresh"
        >
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Backblaze-style sub-tabs. `name='subtab'` keeps the parent
          ?tab=browse param intact — sub-state lives in ?subtab=. */}
      <TabView
        name="subtab"
        className="bg-base-100 rounded-gw-md border border-hairline px-1.5"
        tabs={[
          {
            name: "objects",
            title: "Objects",
            icon: FolderOpen,
            Component: ObjectsSubTab,
          },
          {
            name: "sharing",
            title: "Sharing",
            icon: Share2,
            Component: SharingSubTab,
          },
          {
            name: "keys",
            title: "Keys",
            icon: Key,
            Component: KeysSubTab,
          },
        ]}
      />

      {/* Disclosure dialogs (createDisclosure) mounted at the shell so
          any sub-tab can call e.g. presignDialog.open({key}) and the
          modal renders into the same portal regardless of active tab. */}
      <PresignDialog />
      <ShareDialog />
      <CopyMoveDialog />

      {/* Floating bottom-right transfer queue stays at shell scope so an
          in-flight upload remains visible after the user switches away
          from the Objects sub-tab. */}
      <TransferQueue />
    </div>
  );
};

export default BrowseTab;
