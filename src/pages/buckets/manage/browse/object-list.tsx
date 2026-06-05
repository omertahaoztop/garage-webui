import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert } from "react-daisyui";
import { FixedSizeList as List } from "react-window";
import {
  CircleXIcon,
  FileArchive,
  FileIcon,
  FileType,
  Folder,
  Loader2,
} from "lucide-react";
import mime from "mime/lite";
import { cn, dayjs, readableBytes } from "@/lib/utils";
import { API_URL } from "@/lib/api";
import { useBucketContext } from "../context";
import { useInfiniteBrowseObjects } from "./hooks";
import ObjectActions from "./object-actions";
import { BrowserObject } from "./types";
import {
  defaultFilterState,
  EXT_GROUP_EXTENSIONS,
  type FilterState,
} from "./filter-panel";

const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 40;
const FOOTER_HEIGHT = 36;
const LIST_HEIGHT_MIN = 360;

type Row =
  | { type: "prefix"; key: string }
  | { type: "object"; key: string; data: BrowserObject };

type Props = {
  prefix?: string;
  onPrefixChange?: (prefix: string) => void;
  searchQuery?: string;
  filterState?: FilterState;
  selectedKeys: Set<string>;
  onSelectionChange: (s: Set<string>) => void;
  onObjectPreview: (o: BrowserObject) => void;
};

const ObjectList = ({
  prefix = "",
  onPrefixChange,
  searchQuery = "",
  filterState,
  selectedKeys,
  onSelectionChange,
  onObjectPreview,
}: Props) => {
  const { bucketName } = useBucketContext();
  const {
    data,
    error,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteBrowseObjects(bucketName, prefix);

  // Flatten pages → rows. Prefixes (folders) come first, de-duped because S3
  // can return the same CommonPrefix in multiple pages when the prefix straddles
  // a page boundary. Objects keep their natural order.
  const rows = useMemo<Row[]>(() => {
    if (!data?.pages) return [];
    const all: Row[] = [];
    const seenPrefixes = new Set<string>();
    const seenObjects = new Set<string>();

    for (const page of data.pages) {
      for (const p of page.prefixes) {
        if (!seenPrefixes.has(p)) {
          all.push({ type: "prefix", key: p });
          seenPrefixes.add(p);
        }
      }
      for (const o of page.objects) {
        if (!seenObjects.has(o.objectKey)) {
          all.push({ type: "object", key: o.objectKey, data: o });
          seenObjects.add(o.objectKey);
        }
      }
    }
    return all;
  }, [data]);

  // Search filter (substring match) + extension-group filter + sort. All
  // client-side, scoped to currently-loaded pages. Prefixes (folders) always
  // pass the extension filter so users can still navigate; objects are
  // filtered by their tail extension. Sort: prefixes always rendered first
  // (alphabetical by sortOrder), then objects sorted by sortBy.
  const filteredRows = useMemo(() => {
    let result = rows;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => {
        const name =
          r.type === "prefix"
            ? r.key.substring(0, r.key.lastIndexOf("/")).split("/").pop()
            : r.key;
        return name?.toLowerCase().includes(q);
      });
    }

    const fs = filterState ?? defaultFilterState;

    if (fs.extGroup !== "all") {
      const allowedExts = EXT_GROUP_EXTENSIONS[fs.extGroup];
      if (allowedExts) {
        result = result.filter((r) => {
          if (r.type === "prefix") return true;
          const dotIdx = r.key.lastIndexOf(".");
          if (dotIdx < 0) return false;
          const ext = r.key.substring(dotIdx + 1).toLowerCase();
          return allowedExts.includes(ext);
        });
      }
    }

    const prefixes = result.filter((r) => r.type === "prefix");
    const objects = result.filter((r) => r.type === "object");

    prefixes.sort((a, b) => {
      const cmp = a.key.localeCompare(b.key);
      return fs.sortOrder === "asc" ? cmp : -cmp;
    });

    objects.sort((a, b) => {
      if (a.type !== "object" || b.type !== "object") return 0;
      let cmp = 0;
      if (fs.sortBy === "name") {
        cmp = a.key.localeCompare(b.key);
      } else if (fs.sortBy === "size") {
        cmp = (a.data.size ?? 0) - (b.data.size ?? 0);
      } else if (fs.sortBy === "modified") {
        const at = a.data.lastModified
          ? new Date(a.data.lastModified).getTime()
          : 0;
        const bt = b.data.lastModified
          ? new Date(b.data.lastModified).getTime()
          : 0;
        cmp = at - bt;
      }
      return fs.sortOrder === "asc" ? cmp : -cmp;
    });

    return [...prefixes, ...objects];
  }, [rows, searchQuery, filterState]);

  // Auto-paginate as the user scrolls within 10 rows of the end.
  const onItemsRendered = useCallback(
    ({ visibleStopIndex }: { visibleStopIndex: number }) => {
      if (
        visibleStopIndex >= filteredRows.length - 10 &&
        hasNextPage &&
        !isFetchingNextPage
      ) {
        fetchNextPage();
      }
    },
    [filteredRows.length, hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  // Dynamic list height — fills the rest of the viewport.
  const [listHeight, setListHeight] = useState(LIST_HEIGHT_MIN);
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const update = () => {
      const top = containerRef.current?.getBoundingClientRect().top || 280;
      const avail = window.innerHeight - top - HEADER_HEIGHT - FOOTER_HEIGHT - 24;
      setListHeight(Math.max(LIST_HEIGHT_MIN, avail));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Multi-select helpers — selection holds objectKey (relative to current prefix).
  const visibleObjectKeys = useMemo(
    () => filteredRows.filter((r) => r.type === "object").map((r) => r.key),
    [filteredRows]
  );
  const allSelected =
    visibleObjectKeys.length > 0 &&
    visibleObjectKeys.every((k) => selectedKeys.has(k));
  const someSelected = visibleObjectKeys.some((k) => selectedKeys.has(k));

  const toggleAll = () => {
    const next = new Set(selectedKeys);
    if (allSelected) {
      for (const k of visibleObjectKeys) next.delete(k);
    } else {
      for (const k of visibleObjectKeys) next.add(k);
    }
    onSelectionChange(next);
  };

  const toggleOne = (key: string, checked: boolean) => {
    const next = new Set(selectedKeys);
    if (checked) next.add(key);
    else next.delete(key);
    onSelectionChange(next);
  };

  // Header checkbox indeterminate state (ref callback).
  const headerCheckboxRef = useCallback(
    (el: HTMLInputElement | null) => {
      if (el) el.indeterminate = someSelected && !allSelected;
    },
    [someSelected, allSelected]
  );

  // Render single row inside react-window.
  const RowRenderer = ({
    index,
    style,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => {
    const row = filteredRows[index];
    if (!row) return null;

    if (row.type === "prefix") {
      const name = row.key
        .substring(0, row.key.lastIndexOf("/"))
        .split("/")
        .pop();
      return (
        <div
          style={style}
          className="flex items-center px-3 border-b border-base-200/60 hover:bg-base-200/70 cursor-pointer group transition-colors"
          onClick={() => onPrefixChange?.(row.key)}
        >
          <div className="w-8 shrink-0" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Folder size={18} className="text-primary shrink-0" />
            <span className="truncate font-medium">{name}</span>
          </div>
          <div className="w-24 shrink-0" />
          <div className="w-32 shrink-0" />
          <div className="w-20 shrink-0 flex justify-end">
            <ObjectActions
              prefix={prefix}
              object={{ objectKey: row.key, url: "" }}
            />
          </div>
        </div>
      );
    }

    const o = row.data;
    const extIdx = o.objectKey.lastIndexOf(".");
    const ext = extIdx >= 0 ? o.objectKey.substring(extIdx + 1) : null;
    const isSelected = selectedKeys.has(o.objectKey);

    return (
      <div
        style={style}
        className={cn(
          "flex items-center px-3 border-b border-base-200/60 group transition-colors",
          isSelected
            ? "bg-primary/10 hover:bg-primary/15"
            : "hover:bg-base-200/70"
        )}
      >
        <div
          className="w-8 shrink-0 flex justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            className="checkbox checkbox-sm checkbox-primary"
            checked={isSelected}
            onChange={(e) => toggleOne(o.objectKey, e.target.checked)}
          />
        </div>
        <div
          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
          role="button"
          onClick={() => onObjectPreview(o)}
        >
          <FileIconRender ext={ext} object={o} />
          <span className="truncate text-sm" title={o.objectKey}>
            {o.objectKey}
          </span>
        </div>
        <div className="w-24 shrink-0 text-sm text-base-content/70 text-right">
          {readableBytes(o.size)}
        </div>
        <div
          className="w-32 shrink-0 text-sm text-base-content/70 text-right"
          title={dayjs(o.lastModified).format("YYYY-MM-DD HH:mm:ss")}
        >
          {dayjs(o.lastModified).fromNow()}
        </div>
        <div className="w-20 shrink-0 flex justify-end">
          <ObjectActions prefix={prefix} object={o} />
        </div>
      </div>
    );
  };

  // Skeleton placeholder for first load.
  if (isLoading) {
    return (
      <div className="space-y-1 px-3 py-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-2 py-2 animate-pulse"
          >
            <div className="size-4 bg-base-300 rounded" />
            <div className="size-5 bg-base-300 rounded" />
            <div className="h-3 bg-base-300 rounded flex-1 max-w-[60%]" />
            <div className="h-3 bg-base-300 rounded w-16" />
            <div className="h-3 bg-base-300 rounded w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3">
        <Alert status="error" icon={<CircleXIcon />}>
          <span>{error.message}</span>
        </Alert>
      </div>
    );
  }

  if (!filteredRows.length) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center text-base-content/60 px-4">
        <FileIcon size={56} className="mb-3 opacity-40" />
        <p className="text-center">
          {searchQuery
            ? "No objects matching your search."
            : "This folder is empty. Upload a file or create a folder to get started."}
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      {/* Sticky header row */}
      <div
        className="flex items-center px-3 border-b border-base-300 bg-base-200/50 text-xs font-semibold text-base-content/70 uppercase tracking-wide"
        style={{ height: HEADER_HEIGHT }}
      >
        <div className="w-8 shrink-0 flex justify-center">
          <input
            ref={headerCheckboxRef}
            type="checkbox"
            className="checkbox checkbox-sm checkbox-primary"
            checked={allSelected}
            onChange={toggleAll}
            aria-label="Select all visible objects"
          />
        </div>
        <div className="flex-1">Name</div>
        <div className="w-24 text-right">Size</div>
        <div className="w-32 text-right">Modified</div>
        <div className="w-20" />
      </div>

      {/* Virtualized list */}
      <List
        height={listHeight}
        itemCount={filteredRows.length}
        itemSize={ROW_HEIGHT}
        width="100%"
        onItemsRendered={onItemsRendered}
        overscanCount={5}
      >
        {RowRenderer}
      </List>

      {/* Footer: total / selected count + load-more indicator */}
      <div
        className="flex items-center justify-between px-3 border-t border-base-300 bg-base-200/30 text-xs text-base-content/70"
        style={{ height: FOOTER_HEIGHT }}
      >
        <span>
          {selectedKeys.size > 0 ? (
            <strong>{selectedKeys.size} selected</strong>
          ) : (
            <>
              {filteredRows.length} item{filteredRows.length === 1 ? "" : "s"}
              {hasNextPage && " (more available)"}
            </>
          )}
        </span>
        {isFetchingNextPage && (
          <span className="flex items-center gap-1.5">
            <Loader2 className="animate-spin" size={12} />
            Loading more…
          </span>
        )}
      </div>
    </div>
  );
};

const FileIconRender = ({
  ext,
  object,
}: {
  ext: string | null;
  object: BrowserObject;
}) => {
  const lowerExt = ext?.toLowerCase() || "";
  const type = mime.getType(lowerExt)?.split("/")[0];
  let Icon = FileIcon;

  if (["zip", "rar", "7z", "iso", "tar", "gz", "bz2", "xz"].includes(lowerExt)) {
    Icon = FileArchive;
  }

  if (type === "image") {
    const thumbnailSupport = ["jpg", "jpeg", "png", "gif", "webp"].includes(
      lowerExt
    );
    return (
      <img
        src={
          API_URL + object.url + (thumbnailSupport ? "?thumb=1" : "?view=1")
        }
        alt={object.objectKey}
        className="size-5 object-cover rounded shrink-0"
        loading="lazy"
        onError={(e) => {
          // Hide broken thumb → falls back to whitespace; not worth a
          // re-render to swap to an icon. Most common case (svg/avif) is rare.
          (e.target as HTMLElement).style.visibility = "hidden";
        }}
      />
    );
  }

  if (type === "text") {
    Icon = FileType;
  }

  return <Icon size={18} className="text-base-content/60 shrink-0" />;
};

export default ObjectList;
