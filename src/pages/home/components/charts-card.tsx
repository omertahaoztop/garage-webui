import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Activity, Gauge } from "lucide-react";
import { useMetrics, histogramQuantile } from "../metrics-hooks";

const ms = (s?: number) => (s == null ? "—" : `${(s * 1000).toFixed(1)} ms`);

const ChartsCard = () => {
  const { data, isLoading, isError } = useMetrics();

  const latency = useMemo(() => {
    const p = (q: number) => histogramQuantile(data, "api_s3_request_duration", q);
    return [
      { name: "p50", value: (p(0.5) ?? 0) * 1000 },
      { name: "p95", value: (p(0.95) ?? 0) * 1000 },
      { name: "p99", value: (p(0.99) ?? 0) * 1000 },
    ];
  }, [data]);

  const hasLatency = latency.some((d) => d.value > 0);

  const apiRate = useMemo(() => {
    if (!data) return [];
    const reqs = data.byName.get("api_s3_request_counter") ?? [];
    const errs = data.byName.get("api_s3_error_counter") ?? [];
    const errByEp = new Map<string, number>();
    for (const e of errs) {
      const ep = e.labels.api_endpoint ?? "?";
      errByEp.set(ep, (errByEp.get(ep) ?? 0) + e.value);
    }
    const reqByEp = new Map<string, number>();
    for (const r of reqs) {
      const ep = r.labels.api_endpoint ?? "?";
      reqByEp.set(ep, (reqByEp.get(ep) ?? 0) + r.value);
    }
    return [...reqByEp.entries()]
      .map(([ep, count]) => ({ name: ep, count, errors: errByEp.get(ep) ?? 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [data]);

  if (isLoading || isError) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
      {/* Latency */}
      <div className="rounded-gw-md border border-hairline bg-base-100 p-4 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <Gauge size={16} className="text-primary" />
          <h3 className="text-base font-semibold text-fg-primary">S3 Request Latency</h3>
        </div>
        {!hasLatency ? (
          <p className="text-sm text-base-content/50">No request latency data yet.</p>
        ) : (
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={latency} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "currentColor" }} stroke="currentColor" opacity={0.4} />
                <YAxis tick={{ fontSize: 11, fill: "currentColor" }} stroke="currentColor" opacity={0.4} unit="ms" />
                <Tooltip
                  formatter={(v: number) => [`${v.toFixed(1)} ms`, "latency"]}
                  contentStyle={{ background: "var(--gw-surface-1)", border: "1px solid var(--gw-hairline)", borderRadius: 6, fontSize: 12 }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {latency.map((d, i) => (
                    <Cell key={i} fill={d.name === "p99" ? "#f59e0b" : "#6366f1"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="text-xs text-base-content/40 mt-2">
          p50 {ms(latency[0].value / 1000)} · p95 {ms(latency[1].value / 1000)} · p99 {ms(latency[2].value / 1000)}
        </p>
      </div>

      {/* API rate */}
      <div className="rounded-gw-md border border-hairline bg-base-100 p-4 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={16} className="text-primary" />
          <h3 className="text-base font-semibold text-fg-primary">S3 Requests by Endpoint</h3>
        </div>
        {apiRate.length === 0 ? (
          <p className="text-sm text-base-content/50">No S3 request activity yet.</p>
        ) : (
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <BarChart
                data={apiRate}
                layout="vertical"
                margin={{ top: 0, right: 8, bottom: 0, left: 8 }}
              >
                <XAxis type="number" tick={{ fontSize: 11, fill: "currentColor" }} stroke="currentColor" opacity={0.4} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 11, fill: "currentColor" }}
                  stroke="currentColor"
                  opacity={0.6}
                />
                <Tooltip
                  formatter={(v: number, n: string) => [v, n === "errors" ? "errors" : "requests"]}
                  contentStyle={{ background: "var(--gw-surface-1)", border: "1px solid var(--gw-hairline)", borderRadius: 6, fontSize: 12 }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                <Bar dataKey="errors" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChartsCard;
