import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, Globe } from "lucide-react";
import { toast } from "sonner";
import { useUpdateBucket } from "../hooks";
import { useBucketContext } from "../context";
import type { CorsRule } from "../../types";

const METHODS = ["GET", "PUT", "POST", "DELETE", "HEAD"];

const blankRule = (): CorsRule => ({
  AllowedOrigin: ["*"],
  AllowedMethod: ["GET"],
  AllowedHeader: ["*"],
  ExposeHeader: [],
  MaxAgeSeconds: 3600,
});

const CorsSection = () => {
  const { bucket, refetch } = useBucketContext();
  const update = useUpdateBucket(bucket?.id);
  const [rules, setRules] = useState<CorsRule[]>([]);

  useEffect(() => {
    setRules(bucket?.corsRules ?? []);
  }, [bucket]);

  const save = async (next: CorsRule[]) => {
    try {
      await update.mutateAsync({ corsRules: next });
      toast.success("CORS rules saved");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save CORS rules");
    }
  };

  const addRule = () => {
    const next = [...rules, blankRule()];
    setRules(next);
  };

  const removeRule = (i: number) => {
    const next = rules.filter((_, idx) => idx !== i);
    setRules(next);
    save(next);
  };

  const patch = (i: number, p: Partial<CorsRule>) => {
    setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  };

  const toCsv = (arr?: string[]) => (arr ?? []).join(", ");
  const fromCsv = (s: string) =>
    s.split(",").map((x) => x.trim()).filter(Boolean);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Globe size={16} className="text-base-content/60" />
          <span className="font-medium">CORS Rules</span>
        </div>
        <button
          type="button"
          onClick={addRule}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-gw-sm text-xs font-medium border border-hairline bg-base-200 hover:bg-base-300"
        >
          <Plus size={13} /> Add rule
        </button>
      </div>

      {rules.length === 0 ? (
        <p className="text-sm text-base-content/50">
          No CORS rules. Browsers will block cross-origin requests to this bucket.
        </p>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, i) => (
            <div key={i} className="rounded-gw-sm border border-hairline bg-base-200/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-base-content/50">Rule {i + 1}</span>
                <button
                  type="button"
                  onClick={() => removeRule(i)}
                  className="h-6 w-6 rounded-gw-sm text-error hover:bg-error/10 flex items-center justify-center"
                  title="Remove rule"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <Field label="Allowed Origins (comma-separated)">
                <input
                  value={toCsv(rule.AllowedOrigin)}
                  onChange={(e) => patch(i, { AllowedOrigin: fromCsv(e.target.value) })}
                  onBlur={() => save(rules)}
                  placeholder="* or https://app.example.com"
                  className="w-full h-8 px-2 rounded-gw-sm border border-hairline bg-base-100 text-xs"
                />
              </Field>

              <Field label="Allowed Methods">
                <div className="flex flex-wrap gap-1.5">
                  {METHODS.map((m) => {
                    const on = rule.AllowedMethod?.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          const set = new Set(rule.AllowedMethod ?? []);
                          on ? set.delete(m) : set.add(m);
                          const next = rules.map((r, idx) =>
                            idx === i ? { ...r, AllowedMethod: [...set] } : r
                          );
                          setRules(next);
                          save(next);
                        }}
                        className={
                          "h-7 px-2 rounded-gw-sm text-xs font-medium border " +
                          (on
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-hairline bg-base-100 text-base-content/60")
                        }
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Allowed Headers">
                  <input
                    value={toCsv(rule.AllowedHeader)}
                    onChange={(e) => patch(i, { AllowedHeader: fromCsv(e.target.value) })}
                    onBlur={() => save(rules)}
                    placeholder="*"
                    className="w-full h-8 px-2 rounded-gw-sm border border-hairline bg-base-100 text-xs"
                  />
                </Field>
                <Field label="Max Age (seconds)">
                  <input
                    type="number"
                    value={rule.MaxAgeSeconds ?? ""}
                    onChange={(e) =>
                      patch(i, {
                        MaxAgeSeconds: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    onBlur={() => save(rules)}
                    className="w-full h-8 px-2 rounded-gw-sm border border-hairline bg-base-100 text-xs"
                  />
                </Field>
              </div>
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

export default CorsSection;
