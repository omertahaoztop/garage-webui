import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { useUpdateBucket } from "../hooks";
import { useBucketContext } from "../context";
import type { LifecycleRule } from "../../types";

const blankRule = (): LifecycleRule => ({
  Status: "Enabled",
  Filter: { Prefix: "" },
  Expiration: { Days: 30 },
});

const LifecycleSection = () => {
  const { bucket, refetch } = useBucketContext();
  const update = useUpdateBucket(bucket?.id);
  const [rules, setRules] = useState<LifecycleRule[]>([]);

  useEffect(() => {
    setRules(bucket?.lifecycleRules ?? []);
  }, [bucket]);

  const save = async (next: LifecycleRule[]) => {
    try {
      await update.mutateAsync({ lifecycleRules: next });
      toast.success("Lifecycle rules saved");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save lifecycle rules");
    }
  };

  const patch = (i: number, p: Partial<LifecycleRule>) =>
    setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  const removeRule = (i: number) => {
    const next = rules.filter((_, idx) => idx !== i);
    setRules(next);
    save(next);
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CalendarClock size={16} className="text-base-content/60" />
          <span className="font-medium">Lifecycle / Expiration</span>
        </div>
        <button
          type="button"
          onClick={() => setRules([...rules, blankRule()])}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-gw-sm text-xs font-medium border border-hairline bg-base-200 hover:bg-base-300"
        >
          <Plus size={13} /> Add rule
        </button>
      </div>

      {rules.length === 0 ? (
        <p className="text-sm text-base-content/50">
          No lifecycle rules. Objects are kept until manually deleted.
        </p>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, i) => (
            <div key={i} className="rounded-gw-sm border border-hairline bg-base-200/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={rule.Status === "Enabled"}
                    onChange={(e) => {
                      const next = rules.map((r, idx) =>
                        idx === i
                          ? { ...r, Status: (e.target.checked ? "Enabled" : "Disabled") as LifecycleRule["Status"] }
                          : r
                      );
                      setRules(next);
                      save(next);
                    }}
                    className="checkbox checkbox-xs"
                  />
                  <span className="text-base-content/60">
                    Rule {i + 1} ({rule.Status})
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => removeRule(i)}
                  className="h-6 w-6 rounded-gw-sm text-error hover:bg-error/10 flex items-center justify-center"
                  title="Remove rule"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Prefix filter (optional)">
                  <input
                    value={rule.Filter?.Prefix ?? ""}
                    onChange={(e) => patch(i, { Filter: { ...rule.Filter, Prefix: e.target.value } })}
                    onBlur={() => save(rules)}
                    placeholder="logs/"
                    className="w-full h-8 px-2 rounded-gw-sm border border-hairline bg-base-100 text-xs"
                  />
                </Field>
                <Field label="Expire after (days)">
                  <input
                    type="number"
                    min={1}
                    value={rule.Expiration?.Days ?? ""}
                    onChange={(e) =>
                      patch(i, {
                        Expiration: e.target.value
                          ? { Days: Number(e.target.value) }
                          : null,
                      })
                    }
                    onBlur={() => save(rules)}
                    placeholder="30"
                    className="w-full h-8 px-2 rounded-gw-sm border border-hairline bg-base-100 text-xs"
                  />
                </Field>
              </div>

              <Field label="Abort incomplete multipart uploads after (days, optional)">
                <input
                  type="number"
                  min={1}
                  value={rule.AbortIncompleteMultipartUpload?.DaysAfterInitiation ?? ""}
                  onChange={(e) =>
                    patch(i, {
                      AbortIncompleteMultipartUpload: e.target.value
                        ? { DaysAfterInitiation: Number(e.target.value) }
                        : null,
                    })
                  }
                  onBlur={() => save(rules)}
                  placeholder="7"
                  className="w-full h-8 px-2 rounded-gw-sm border border-hairline bg-base-100 text-xs"
                />
              </Field>
            </div>
          ))}
        </div>
      )}
      {update.isPending && (
        <p className="text-xs text-base-content/50 mt-2 inline-flex items-center gap-1">
          <Loader2 size={12} className="animate-spin" /> Saving…
        </p>
      )}
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="text-xs text-base-content/50 block mb-0.5">{label}</span>
    {children}
  </label>
);

export default LifecycleSection;
