import { ArrowDown, ArrowUp, Filter as Funnel } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// FilterState drives the object-list sort + extension filter pipeline.
// It is a CLIENT-SIDE filter (applied to the already-fetched react-window
// rows) — it does NOT change the S3 ListObjectsV2 query, so it composes
// with the search query and incremental pagination cleanly.
export type SortBy = "name" | "size" | "modified";
export type SortOrder = "asc" | "desc";
export type ExtGroup =
  | "all"
  | "image"
  | "video"
  | "audio"
  | "text"
  | "pdf"
  | "archive";

export interface FilterState {
  sortBy: SortBy;
  sortOrder: SortOrder;
  extGroup: ExtGroup;
}

export const defaultFilterState: FilterState = {
  sortBy: "name",
  sortOrder: "asc",
  extGroup: "all",
};

// EXT_GROUP_EXTENSIONS maps a high-level group to a denylist of extensions
// (lowercase, no leading dot). Folders (prefix rows) are exempt from the
// extension filter and always pass through.
export const EXT_GROUP_EXTENSIONS: Record<ExtGroup, string[] | null> = {
  all: null,
  image: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "avif"],
  video: ["mp4", "webm", "mkv", "mov", "avi", "ogv", "m4v"],
  audio: ["mp3", "wav", "ogg", "flac", "aac", "m4a", "opus"],
  text: [
    "txt",
    "md",
    "json",
    "yaml",
    "yml",
    "html",
    "htm",
    "css",
    "js",
    "ts",
    "tsx",
    "jsx",
    "go",
    "py",
    "rs",
    "c",
    "cpp",
    "h",
    "sh",
    "log",
    "csv",
  ],
  pdf: ["pdf"],
  archive: ["zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar", "iso"],
};

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "size", label: "Size" },
  { value: "modified", label: "Modified" },
];

const EXT_GROUPS: { value: ExtGroup; label: string }[] = [
  { value: "all", label: "All" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
  { value: "audio", label: "Audio" },
  { value: "text", label: "Text" },
  { value: "pdf", label: "PDFs" },
  { value: "archive", label: "Archives" },
];

type Props = {
  state: FilterState;
  onChange: (s: FilterState) => void;
};

// FilterPanel renders the Funnel button + dropdown panel. The dropdown is a
// regular DIV positioned absolutely below the trigger (we avoid DaisyUI's
// .dropdown component because it intercepts blur events that conflict with
// our chip toggle clicks). Click-outside closes the panel.
const FilterPanel = ({ state, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isDefault =
    state.sortBy === "name" &&
    state.sortOrder === "asc" &&
    state.extGroup === "all";

  const badgeCount =
    (state.sortBy !== "name" || state.sortOrder !== "asc" ? 1 : 0) +
    (state.extGroup !== "all" ? 1 : 0);

  // Click-outside dismiss. We listen on `mousedown` so React onClick (which
  // fires on `click`) is guaranteed to run AFTER our containment check —
  // chips clicked inside the panel stay open until the user explicitly
  // closes via the trigger button or clicks outside. Composedpath check
  // guards against React portals re-mounting elements outside `ref`.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      const panel = ref.current;
      if (!panel || !target) return;
      if (panel.contains(target)) return;
      // composedPath catches shadow DOM / portal edge cases.
      const path = typeof e.composedPath === "function" ? e.composedPath() : [];
      if (path.some((n) => n === panel)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        title="Filter / sort"
        className={cn(
          "btn btn-sm gap-1.5 px-3 min-h-0 h-10",
          isDefault ? "btn-ghost" : "btn-primary"
        )}
        onClick={() => setOpen((o) => !o)}
      >
        <Funnel size={16} />
        <span className="hidden sm:inline">Filter</span>
        {!isDefault && (
          <span
            className={cn(
              "badge badge-sm",
              "bg-white text-primary border-white"
            )}
          >
            {badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-base-100 border border-base-300 rounded-lg shadow-lg z-30 p-3">
          {/* Sort */}
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-base-content/70 uppercase mb-2">
              Sort by
            </h4>
            <div className="flex gap-1.5 mb-2">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={cn(
                    "btn btn-xs flex-1",
                    state.sortBy === opt.value ? "btn-primary" : "btn-ghost"
                  )}
                  onClick={() =>
                    onChange({ ...state, sortBy: opt.value })
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                className={cn(
                  "btn btn-xs flex-1 gap-1",
                  state.sortOrder === "asc" ? "btn-primary" : "btn-ghost"
                )}
                onClick={() => onChange({ ...state, sortOrder: "asc" })}
              >
                <ArrowUp size={12} />
                Ascending
              </button>
              <button
                type="button"
                className={cn(
                  "btn btn-xs flex-1 gap-1",
                  state.sortOrder === "desc" ? "btn-primary" : "btn-ghost"
                )}
                onClick={() => onChange({ ...state, sortOrder: "desc" })}
              >
                <ArrowDown size={12} />
                Descending
              </button>
            </div>
          </div>

          {/* Extension group */}
          <div>
            <h4 className="text-xs font-semibold text-base-content/70 uppercase mb-2">
              File type
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {EXT_GROUPS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  className={cn(
                    "btn btn-xs",
                    state.extGroup === g.value
                      ? "btn-primary"
                      : "btn-ghost"
                  )}
                  onClick={() =>
                    onChange({ ...state, extGroup: g.value })
                  }
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {!isDefault && (
            <button
              type="button"
              className="btn btn-xs btn-ghost w-full mt-3"
              onClick={() => onChange(defaultFilterState)}
            >
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterPanel;
