import Page from "@/context/page-context";
import { useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  KeyRound,
  Copy,
  Check,
  ShieldAlert,
  X,
} from "lucide-react";
import { cn, copyToClipboard } from "@/lib/utils";
import {
  useAdminTokens,
  useCreateToken,
  useDeleteToken,
  expiryToISO,
  type AdminTokenInfo,
  type CreateTokenResult,
} from "./hooks";

const EXPIRY_PRESETS = [
  { value: "never", label: "Never" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "custom", label: "Custom date" },
];

const AdminTokensPage = () => {
  const tokensQuery = useAdminTokens();
  const del = useDeleteToken();
  const [showCreate, setShowCreate] = useState(false);
  const [created, setCreated] = useState<CreateTokenResult | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminTokenInfo | null>(null);

  const tokens = tokensQuery.data?.tokens ?? [];

  const doDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      await del.mutateAsync(deleteTarget.id);
      toast.success(`Token "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="container">
      <Page title="Admin Tokens" />

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-fg-primary">Admin Tokens</h1>
          <p className="text-sm text-base-content/60 mt-0.5">
            Scoped, expiring credentials for the Garage admin API. The secret is shown only once.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-gw-sm text-sm font-medium bg-primary text-primary-content hover:bg-primary/90"
        >
          <Plus size={14} /> New Token
        </button>
      </div>

      <div className="mt-6 rounded-gw-md border border-hairline overflow-hidden">
        {tokensQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-base-content/60 p-4">
            <Loader2 size={16} className="animate-spin" /> Loading tokens…
          </div>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-base-content/60 p-4">No admin tokens yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-base-200 text-base-content/60 text-xs">
              <tr>
                <th className="text-left font-medium px-3 py-2">Name</th>
                <th className="text-left font-medium px-3 py-2">Scope</th>
                <th className="text-left font-medium px-3 py-2">Expiration</th>
                <th className="text-left font-medium px-3 py-2">Status</th>
                <th className="text-right font-medium px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id ?? t.name} className="border-t border-hairline">
                  <td className="px-3 py-2 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <KeyRound size={13} className="text-base-content/40" />
                      {t.name}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(t.scope ?? []).map((s) => (
                        <span
                          key={s}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-base-300 text-base-content/70 font-mono"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-base-content/60">
                    {t.expiration ? new Date(t.expiration).toLocaleString() : "Never"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        t.expired ? "text-error" : "text-success"
                      )}
                    >
                      {t.expired ? "Expired" : "Active"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(t)}
                      className="h-7 w-7 rounded-gw-sm border border-hairline text-error hover:bg-error/10 inline-flex items-center justify-center"
                      title="Delete token"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateTokenDialog
          onClose={() => setShowCreate(false)}
          onCreated={(res) => {
            setShowCreate(false);
            setCreated(res);
          }}
        />
      )}

      {created && <SecretRevealDialog token={created} onClose={() => setCreated(null)} />}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Admin Token"
          message={`Permanently delete "${deleteTarget.name}"? Any client using this token will lose access immediately.`}
          confirmLabel="Delete"
          pending={del.isPending}
          onConfirm={doDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

const CreateTokenDialog = ({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (res: CreateTokenResult) => void;
}) => {
  const create = useCreateToken();
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("never");
  const [customDate, setCustomDate] = useState("");
  const [scopeAll, setScopeAll] = useState(true);
  const [scopeText, setScopeText] = useState("");

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    const scope = scopeAll
      ? ["*"]
      : scopeText
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean);
    if (!scope.length) {
      toast.error("Provide at least one scope entry or select 'Full access'");
      return;
    }
    const presetVal = expiry === "custom" ? customDate : expiry;
    if (expiry === "custom" && !customDate) {
      toast.error("Pick a custom expiry date");
      return;
    }
    const { expiration, neverExpires } = expiryToISO(presetVal);
    try {
      const res = await create.mutateAsync({
        name: name.trim(),
        scope,
        expiration,
        neverExpires,
      });
      toast.success("Token created");
      onCreated(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    }
  };

  return (
    <Modal onClose={onClose} title="New Admin Token">
      <div className="space-y-3">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ci-deploy-token"
            className="w-full h-9 px-2 rounded-gw-sm border border-hairline bg-base-200 text-sm"
          />
        </Field>

        <Field label="Scope">
          <label className="flex items-center gap-2 text-sm mb-2">
            <input
              type="checkbox"
              checked={scopeAll}
              onChange={(e) => setScopeAll(e.target.checked)}
              className="checkbox checkbox-sm"
            />
            Full access (<code className="font-mono text-xs">*</code>)
          </label>
          {!scopeAll && (
            <textarea
              value={scopeText}
              onChange={(e) => setScopeText(e.target.value)}
              rows={3}
              placeholder="One scope per line, e.g.&#10;CreateBucket&#10;GetClusterStatus"
              className="w-full px-2 py-1.5 rounded-gw-sm border border-hairline bg-base-200 text-sm font-mono"
            />
          )}
        </Field>

        <Field label="Expiration">
          <select
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="w-full h-9 px-2 rounded-gw-sm border border-hairline bg-base-200 text-sm"
          >
            {EXPIRY_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          {expiry === "custom" && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="w-full h-9 px-2 mt-2 rounded-gw-sm border border-hairline bg-base-200 text-sm"
            />
          )}
        </Field>
      </div>

      <div className="flex justify-end gap-2 mt-5">
        <button
          onClick={onClose}
          className="h-9 px-3 rounded-gw-sm text-sm border border-hairline bg-base-100 hover:bg-base-200"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={create.isPending}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-gw-sm text-sm font-medium bg-primary text-primary-content hover:bg-primary/90 disabled:opacity-60"
        >
          {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Create
        </button>
      </div>
    </Modal>
  );
};

const SecretRevealDialog = ({
  token,
  onClose,
}: {
  token: CreateTokenResult;
  onClose: () => void;
}) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await copyToClipboard(token.secretToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Modal onClose={onClose} title="Token Created">
      <div className="flex items-center gap-2 text-warning mb-3">
        <ShieldAlert size={18} />
        <p className="text-sm">
          Copy this secret now — it will <strong>never be shown again</strong>.
        </p>
      </div>
      <div className="rounded-gw-sm border border-hairline bg-base-200 p-3">
        <p className="text-xs text-base-content/50 mb-1">{token.name}</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-xs break-all">{token.secretToken}</code>
          <button
            onClick={copy}
            className="h-8 w-8 shrink-0 rounded-gw-sm border border-hairline bg-base-100 hover:bg-base-300 flex items-center justify-center"
            title="Copy"
          >
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          </button>
        </div>
      </div>
      <div className="flex justify-end mt-5">
        <button
          onClick={onClose}
          className="h-9 px-3 rounded-gw-sm text-sm font-medium bg-primary text-primary-content hover:bg-primary/90"
        >
          Done
        </button>
      </div>
    </Modal>
  );
};

const ConfirmDialog = ({
  title,
  message,
  confirmLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) => (
  <Modal onClose={onCancel} title={title}>
    <p className="text-sm text-base-content/70">{message}</p>
    <div className="flex justify-end gap-2 mt-5">
      <button
        onClick={onCancel}
        className="h-9 px-3 rounded-gw-sm text-sm border border-hairline bg-base-100 hover:bg-base-200"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={pending}
        className="inline-flex items-center gap-2 h-9 px-3 rounded-gw-sm text-sm font-medium bg-error text-error-content hover:bg-error/90 disabled:opacity-60"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        {confirmLabel}
      </button>
    </div>
  </Modal>
);

const Modal = ({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div className="absolute inset-0 bg-black/40" />
    <div
      className="relative w-full max-w-md bg-base-100 rounded-gw-md shadow-xl p-5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold">{title}</h3>
        <button onClick={onClose} className="text-base-content/50 hover:text-base-content">
          <X size={18} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-xs text-base-content/60 block mb-1">{label}</label>
    {children}
  </div>
);

export default AdminTokensPage;
