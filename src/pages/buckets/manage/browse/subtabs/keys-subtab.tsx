import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "react-daisyui";
import { Key, Lock, Eye, Pencil, Shield, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBucketContext } from "../../context";

type FilterMode = "all" | "read" | "write" | "owner";

const FILTER_CHIPS: Array<{ value: FilterMode; label: string }> = [
  { value: "all", label: "All" },
  { value: "read", label: "Read" },
  { value: "write", label: "Write" },
  { value: "owner", label: "Owner" },
];

/**
 * KeysSubTab — read-only summary of bucket-bound access keys. Filterable
 * by permission level. Designed as a "preview" view so users can scan
 * keys without leaving the Browse tab; mutation (grant/revoke) stays in
 * the Permissions tab and is reached via a single CTA.
 */
const KeysSubTab = () => {
  const { bucket } = useBucketContext();
  const [, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<FilterMode>("all");

  const filteredKeys = useMemo(() => {
    const keys = bucket.keys ?? [];
    if (filter === "all") return keys;
    return keys.filter((k) => k.permissions[filter]);
  }, [bucket.keys, filter]);

  const goToPermissions = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", "permissions");
      return next;
    });
  };

  const totalKeys = bucket.keys?.length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-hairline flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-10 h-10 rounded-gw-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Key size={18} strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-body font-semibold text-fg-primary">
              Access keys
            </h3>
            <p className="text-body-sm text-fg-secondary">
              {totalKeys === 0
                ? "No keys are currently bound to this bucket."
                : `${totalKeys} key${totalKeys === 1 ? "" : "s"} attached to this bucket.`}
            </p>
          </div>
          <button
            type="button"
            onClick={goToPermissions}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-gw-sm border border-hairline bg-base-200 hover:bg-base-300 text-fg-secondary hover:text-fg-primary text-body-sm transition-colors duration-100"
          >
            <span>Manage in Permissions</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {totalKeys > 0 && (
          <>
            {/* Filter chip row */}
            <div className="px-4 md:px-6 py-3 border-b border-hairline flex flex-wrap items-center gap-2">
              <span className="text-body-sm text-fg-muted mr-1">Filter:</span>
              {FILTER_CHIPS.map((chip) => (
                <FilterChip
                  key={chip.value}
                  label={chip.label}
                  active={filter === chip.value}
                  onClick={() => setFilter(chip.value)}
                />
              ))}
            </div>

            {/* Key list */}
            {filteredKeys.length === 0 ? (
              <div className="p-6 text-center text-body-sm text-fg-secondary">
                No keys match the selected filter.
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {filteredKeys.map((k) => (
                  <KeyRow key={k.accessKeyId} bucketKey={k} />
                ))}
              </ul>
            )}
          </>
        )}
      </Card>
    </div>
  );
};

type BucketKey = {
  accessKeyId: string;
  name?: string;
  permissions: { read: boolean; write: boolean; owner: boolean };
  bucketLocalAliases?: string[];
};

const KeyRow = ({ bucketKey }: { bucketKey: BucketKey }) => {
  const displayName =
    bucketKey.name || bucketKey.accessKeyId.slice(0, 8) || "(unnamed)";
  const aliases = bucketKey.bucketLocalAliases ?? [];

  return (
    <li className="px-4 md:px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-fg-primary truncate">
            {displayName}
          </span>
          {aliases.length > 0 && (
            <span className="text-body-sm text-fg-muted truncate">
              · {aliases.join(", ")}
            </span>
          )}
        </div>
        <code className="block text-body-sm text-fg-muted font-mono truncate">
          {bucketKey.accessKeyId}
        </code>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <PermissionBadge
          icon={Eye}
          label="Read"
          granted={bucketKey.permissions.read}
        />
        <PermissionBadge
          icon={Pencil}
          label="Write"
          granted={bucketKey.permissions.write}
        />
        <PermissionBadge
          icon={Shield}
          label="Owner"
          granted={bucketKey.permissions.owner}
        />
      </div>
    </li>
  );
};

const FilterChip = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "inline-flex items-center h-7 px-2.5 rounded-full text-body-sm",
      "transition-colors duration-100",
      active
        ? "bg-primary/15 text-primary border border-primary/30"
        : "bg-base-200 text-fg-secondary border border-hairline hover:bg-base-300"
    )}
  >
    {label}
  </button>
);

const PermissionBadge = ({
  icon: Icon,
  label,
  granted,
}: {
  icon: typeof Lock;
  label: string;
  granted: boolean;
}) => (
  <span
    title={`${label}: ${granted ? "granted" : "denied"}`}
    className={cn(
      "inline-flex items-center gap-1 h-6 px-2 rounded-gw-xs text-xs",
      granted
        ? "bg-success/15 text-success"
        : "bg-base-200 text-fg-muted line-through opacity-60"
    )}
  >
    <Icon size={12} />
    {label}
  </span>
);

export default KeysSubTab;
