import Page from "@/context/page-context";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, GitBranch, Check, Undo2, FlaskConical, History, SkipForward, AlertTriangle, X } from "lucide-react";
import { readableBytes, cn } from "@/lib/utils";
import {
  useClusterLayout,
  useLayoutHistory,
  usePreviewLayout,
  useApplyLayout,
  useRevertLayout,
  useSkipDeadNodes,
  useStageLayout,
  type PreviewResult,
  type NodeRoleChange,
  type ComputationStat,
} from "./hooks";

const LayoutPage = () => {
  const layoutQuery = useClusterLayout();
  const historyQuery = useLayoutHistory();
  const preview = usePreviewLayout();
  const apply = useApplyLayout();
  const revert = useRevertLayout();
  const skipDead = useSkipDeadNodes();
  const stage = useStageLayout();

  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [showSkipDead, setShowSkipDead] = useState(false);

  const layout = layoutQuery.data;
  const hasStaged =
    (layout?.stagedRoleChanges?.length ?? 0) > 0 || layout?.stagedParameters != null;

  const runPreview = async () => {
    try {
      const res = await preview.mutateAsync();
      setPreviewResult(res);
      if ("error" in res) toast.error(res.error);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    }
  };

  const runApply = async () => {
    if (!layout) return;
    const nextVersion = layout.version + 1;
    if (
      !window.confirm(
        `Apply staged layout changes as version ${nextVersion}? This will rebalance data across the cluster.`
      )
    )
      return;
    try {
      await apply.mutateAsync(nextVersion);
      toast.success(`Layout v${nextVersion} applied`);
      setPreviewResult(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apply failed");
    }
  };

  const runRevert = async () => {
    if (!window.confirm("Discard all staged layout changes?")) return;
    try {
      await revert.mutateAsync();
      toast.success("Staged changes reverted");
      setPreviewResult(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Revert failed");
    }
  };

  return (
    <div className="container">
      <Page title="Cluster Layout" />

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-fg-primary">Cluster Layout</h1>
          <p className="text-sm text-base-content/60 mt-0.5">
            Stage role changes, preview the impact, then apply a new layout version.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-gw-sm bg-base-200 text-sm font-medium">
            <GitBranch size={14} /> v{layout?.version ?? "—"}
          </span>
        </div>
      </div>

      {layoutQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-base-content/60 mt-6">
          <Loader2 size={16} className="animate-spin" /> Loading layout…
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mt-6">
            <CurrentRoles layout={layout} onStage={stage.mutateAsync} staging={stage.isPending} />
            <StagedChanges layout={layout} />
          </section>

          {/* Workflow */}
          <section className="mt-6 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runPreview}
              disabled={preview.isPending || !hasStaged}
              className={cn(
                "inline-flex items-center gap-2 h-9 px-3 rounded-gw-sm text-sm font-medium border border-hairline",
                "bg-base-200 hover:bg-base-300 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {preview.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FlaskConical size={14} />
              )}
              Preview Diff
            </button>
            <button
              type="button"
              onClick={runApply}
              disabled={apply.isPending || !hasStaged}
              className={cn(
                "inline-flex items-center gap-2 h-9 px-3 rounded-gw-sm text-sm font-medium",
                "bg-primary text-primary-content hover:bg-primary/90",
                "disabled:opacity-60 disabled:cursor-not-allowed"
              )}
            >
              {apply.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              Apply as v{(layout?.version ?? 0) + 1}
            </button>
            <button
              type="button"
              onClick={runRevert}
              disabled={revert.isPending || !hasStaged}
              className={cn(
                "inline-flex items-center gap-2 h-9 px-3 rounded-gw-sm text-sm font-medium border border-hairline",
                "bg-base-100 hover:bg-base-200 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {revert.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Undo2 size={14} />
              )}
              Revert
            </button>
          </section>

          {previewResult && "newLayout" in previewResult && (
            <PreviewPanel
              messages={previewResult.message}
              stats={previewResult.statistics}
            />
          )}

          <LayoutHistoryTimeline
            versions={historyQuery.data?.versions ?? []}
            current={historyQuery.data?.currentVersion}
          />

          <DangerZone onSkipDead={() => setShowSkipDead(true)} />
        </>
      )}

      {showSkipDead && layout && (
        <SkipDeadModal
          currentVersion={layout.version}
          pending={skipDead.isPending}
          onClose={() => setShowSkipDead(false)}
          onConfirm={async (allowMissingData) => {
            try {
              const res = await skipDead.mutateAsync({
                version: layout.version,
                allowMissingData,
              });
              toast.success(
                `Skipped dead nodes: ${res.ackUpdated.length} ack, ${res.syncUpdated.length} sync updated`
              );
              setShowSkipDead(false);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Skip dead nodes failed");
            }
          }}
        />
      )}
    </div>
  );
};

type StageFn = (body: { roles?: NodeRoleChange[] }) => Promise<unknown>;

const CurrentRoles = ({
  layout,
  onStage,
  staging,
}: {
  layout: ReturnType<typeof useClusterLayout>["data"];
  onStage: StageFn;
  staging: boolean;
}) => (
  <div className="rounded-gw-md border border-hairline bg-base-100 p-4">
    <h3 className="text-sm font-semibold text-fg-primary mb-3">
      Current Roles ({layout?.roles.length ?? 0})
    </h3>
    {!layout?.roles.length ? (
      <p className="text-sm text-base-content/50">No assigned roles.</p>
    ) : (
      <ul className="space-y-2">
        {layout.roles.map((role) => (
          <RoleRow key={role.id} role={role} onStage={onStage} staging={staging} />
        ))}
      </ul>
    )}
  </div>
);

type Role = NonNullable<ReturnType<typeof useClusterLayout>["data"]>["roles"][number];

const RoleRow = ({
  role,
  onStage,
  staging,
}: {
  role: Role;
  onStage: StageFn;
  staging: boolean;
}) => {
  const [editing, setEditing] = useState(false);
  const [zone, setZone] = useState(role.zone);
  const [capacityGB, setCapacityGB] = useState(
    role.capacity ? String(Math.round(role.capacity / 1_000_000_000)) : ""
  );
  const [tags, setTags] = useState((role.tags ?? []).join(", "));

  const save = async () => {
    const cap = capacityGB.trim() === "" ? null : Number(capacityGB) * 1_000_000_000;
    if (cap !== null && (Number.isNaN(cap) || cap <= 0)) {
      toast.error("Capacity must be a positive number (GB) or empty for gateway");
      return;
    }
    const change: NodeRoleChange = {
      id: role.id,
      zone: zone.trim(),
      capacity: cap,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    try {
      await onStage({ roles: [change] });
      toast.success("Role change staged");
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Stage failed");
    }
  };

  const remove = async () => {
    if (!window.confirm(`Stage removal of node ${role.id.slice(0, 16)}?`)) return;
    try {
      await onStage({ roles: [{ id: role.id, remove: true }] });
      toast.success("Node removal staged");
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Stage failed");
    }
  };

  return (
    <li className="rounded-gw-sm border border-hairline bg-base-200/40 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs truncate">{role.id.slice(0, 16)}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs px-1.5 py-0.5 rounded bg-base-300 text-base-content/70">
            {role.zone}
          </span>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="text-xs text-primary hover:underline"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>
      </div>

      {!editing ? (
        <div className="flex items-center gap-3 mt-1 text-xs text-base-content/60">
          <span>cap: {role.capacity ? readableBytes(role.capacity) : "gateway"}</span>
          {role.tags?.length > 0 && <span>tags: {role.tags.join(", ")}</span>}
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs">
              <span className="text-base-content/50 block mb-0.5">Zone</span>
              <input
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full h-8 px-2 rounded-gw-sm border border-hairline bg-base-100 text-xs"
              />
            </label>
            <label className="text-xs">
              <span className="text-base-content/50 block mb-0.5">Capacity (GB, empty=gateway)</span>
              <input
                value={capacityGB}
                onChange={(e) => setCapacityGB(e.target.value)}
                placeholder="gateway"
                className="w-full h-8 px-2 rounded-gw-sm border border-hairline bg-base-100 text-xs"
              />
            </label>
          </div>
          <label className="text-xs block">
            <span className="text-base-content/50 block mb-0.5">Tags (comma-separated)</span>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full h-8 px-2 rounded-gw-sm border border-hairline bg-base-100 text-xs"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={staging}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-gw-sm text-xs font-medium bg-primary text-primary-content hover:bg-primary/90 disabled:opacity-60"
            >
              {staging ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Stage change
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={staging}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-gw-sm text-xs font-medium border border-error/40 text-error hover:bg-error/10 disabled:opacity-60"
            >
              Remove node
            </button>
          </div>
        </div>
      )}
    </li>
  );
};

const StagedChanges = ({ layout }: { layout: ReturnType<typeof useClusterLayout>["data"] }) => {
  const changes = layout?.stagedRoleChanges ?? [];
  return (
    <div className="rounded-gw-md border border-hairline bg-base-100 p-4">
      <h3 className="text-sm font-semibold text-fg-primary mb-3">
        Staged Changes ({changes.length})
      </h3>
      {!changes.length && !layout?.stagedParameters ? (
        <p className="text-sm text-base-content/50">No staged changes.</p>
      ) : (
        <ul className="space-y-2">
          {changes.map((c) => (
            <li
              key={c.id}
              className={cn(
                "rounded-gw-sm border px-3 py-2 text-xs",
                "remove" in c
                  ? "border-error/40 bg-error/5"
                  : "border-success/40 bg-success/5"
              )}
            >
              <span className="font-mono">{c.id.slice(0, 16)}</span>
              {"remove" in c ? (
                <span className="ml-2 text-error font-medium">REMOVE</span>
              ) : (
                <span className="ml-2 text-base-content/70">
                  zone={c.zone} cap=
                  {c.capacity ? readableBytes(c.capacity) : "gateway"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const PreviewPanel = ({
  messages,
  stats,
}: {
  messages: string[];
  stats: ComputationStat | null;
}) => (
  <section className="mt-6 rounded-gw-md border border-primary/30 bg-primary/5 p-4">
    <h3 className="text-sm font-semibold text-fg-primary mb-2">Preview</h3>
    {messages?.length > 0 && (
      <pre className="text-xs font-mono text-base-content/70 whitespace-pre-wrap mb-3">
        {messages.join("\n")}
      </pre>
    )}
    {stats && (
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        <Stat label="Replication" value={String(stats.replicationFactor)} />
        <Stat label="Partition Size" value={readableBytes(stats.partitionSize)} />
        <Stat label="Usable Capacity" value={readableBytes(stats.usableCapacity)} />
        <Stat label="Total Capacity" value={readableBytes(stats.totalCapacity)} />
        <Stat label="Zone Redundancy" value={String(stats.effectiveZoneRedundancy)} />
        {stats.totalMovedPartitions != null && (
          <Stat label="Moved Partitions" value={String(stats.totalMovedPartitions)} />
        )}
      </dl>
    )}
  </section>
);

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="text-base-content/50">{label}</dt>
    <dd className="font-medium text-fg-primary">{value}</dd>
  </div>
);

const LayoutHistoryTimeline = ({
  versions,
  current,
}: {
  versions: { version: number; status: string; storageNodes: number; gatewayNodes: number }[];
  current?: number;
}) => {
  const sorted = useMemo(
    () => [...versions].sort((a, b) => b.version - a.version),
    [versions]
  );
  if (!sorted.length) return null;
  return (
    <section className="mt-6">
      <h3 className="text-sm font-semibold text-fg-primary mb-3 inline-flex items-center gap-2">
        <History size={14} /> Layout History
      </h3>
      <ul className="space-y-2">
        {sorted.map((v) => (
          <li
            key={v.version}
            className={cn(
              "flex items-center justify-between gap-3 rounded-gw-sm border px-3 py-2 text-sm",
              v.version === current
                ? "border-primary/40 bg-primary/5"
                : "border-hairline bg-base-100"
            )}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">v{v.version}</span>
              {v.version === current && (
                <span className="text-[10px] uppercase tracking-wide text-primary font-semibold">
                  current
                </span>
              )}
              <span className="text-xs text-base-content/60">{v.status}</span>
            </div>
            <span className="text-xs text-base-content/50">
              {v.storageNodes} storage · {v.gatewayNodes} gateway
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

const DangerZone = ({ onSkipDead }: { onSkipDead: () => void }) => (
  <section className="mt-8 rounded-gw-md border border-error/30 bg-error/5 p-4">
    <h3 className="text-sm font-semibold text-error mb-1 inline-flex items-center gap-2">
      <AlertTriangle size={14} /> Danger Zone
    </h3>
    <p className="text-xs text-base-content/60 mb-3">
      Force a layout transition past unresponsive nodes. Only use this when a node is
      permanently lost and the cluster is stuck.
    </p>
    <button
      type="button"
      onClick={onSkipDead}
      className="inline-flex items-center gap-2 h-9 px-3 rounded-gw-sm text-sm font-medium border border-error/40 text-error hover:bg-error/10"
    >
      <SkipForward size={14} /> Skip Dead Nodes…
    </button>
  </section>
);

const SkipDeadModal = ({
  currentVersion,
  pending,
  onClose,
  onConfirm,
}: {
  currentVersion: number;
  pending: boolean;
  onClose: () => void;
  onConfirm: (allowMissingData: boolean) => void;
}) => {
  const [allowMissingData, setAllowMissingData] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-md bg-base-100 rounded-gw-md shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold inline-flex items-center gap-2 text-error">
            <AlertTriangle size={18} /> Skip Dead Nodes
          </h3>
          <button onClick={onClose} className="text-base-content/50 hover:text-base-content">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-base-content/70 mb-3">
          This forces update trackers past unresponsive nodes for layout
          <span className="font-mono"> v{currentVersion}</span>. Use only when a node is
          permanently dead and blocking layout convergence.
        </p>
        <label className="flex items-start gap-2 text-sm mb-3">
          <input
            type="checkbox"
            checked={allowMissingData}
            onChange={(e) => setAllowMissingData(e.target.checked)}
            className="checkbox checkbox-sm mt-0.5"
          />
          <span>
            Allow missing data
            <span className="block text-xs text-error">
              ⚠ May cause permanent data loss if a quorum cannot be reached among remaining nodes.
            </span>
          </span>
        </label>
        <p className="text-xs text-base-content/60 mb-1">
          Type <span className="font-mono font-semibold">SKIP</span> to confirm:
        </p>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="w-full h-9 px-2 rounded-gw-sm border border-error/40 bg-base-200 text-sm mb-4"
          placeholder="SKIP"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-9 px-3 rounded-gw-sm text-sm border border-hairline bg-base-100 hover:bg-base-200"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(allowMissingData)}
            disabled={confirmText !== "SKIP" || pending}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-gw-sm text-sm font-medium bg-error text-error-content hover:bg-error/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <SkipForward size={14} />}
            Skip Dead Nodes
          </button>
        </div>
      </div>
    </div>
  );
};

export default LayoutPage;
