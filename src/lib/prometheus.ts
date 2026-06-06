export type MetricSample = {
  name: string;
  labels: Record<string, string>;
  value: number;
};

export type ParsedMetrics = {
  samples: MetricSample[];
  byName: Map<string, MetricSample[]>;
};

// parsePrometheus turns the text exposition format into structured samples.
// Skips HELP/TYPE comment lines. Handles labels: name{a="b",c="d"} value.
export const parsePrometheus = (text: string): ParsedMetrics => {
  const samples: MetricSample[] = [];
  const byName = new Map<string, MetricSample[]>();

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const braceIdx = line.indexOf("{");
    let name: string;
    const labels: Record<string, string> = {};
    let rest: string;

    if (braceIdx >= 0) {
      name = line.slice(0, braceIdx);
      const closeIdx = line.indexOf("}", braceIdx);
      const labelStr = line.slice(braceIdx + 1, closeIdx);
      rest = line.slice(closeIdx + 1).trim();
      for (const pair of labelStr.split(",")) {
        const eq = pair.indexOf("=");
        if (eq < 0) continue;
        const k = pair.slice(0, eq).trim();
        const v = pair.slice(eq + 1).trim().replace(/^"|"$/g, "");
        if (k) labels[k] = v;
      }
    } else {
      const sp = line.indexOf(" ");
      name = line.slice(0, sp);
      rest = line.slice(sp + 1).trim();
    }

    const value = parseFloat(rest.split(/\s+/)[0]);
    if (Number.isNaN(value)) continue;

    const sample: MetricSample = { name, labels, value };
    samples.push(sample);
    const arr = byName.get(name) ?? [];
    arr.push(sample);
    byName.set(name, arr);
  }

  return { samples, byName };
};

export const sumMetric = (m: ParsedMetrics | undefined, name: string): number => {
  if (!m) return 0;
  return (m.byName.get(name) ?? []).reduce((acc, s) => acc + s.value, 0);
};

export const firstMetric = (
  m: ParsedMetrics | undefined,
  name: string
): number | undefined => m?.byName.get(name)?.[0]?.value;

// histogramQuantile approximates a Prometheus histogram quantile from the
// cumulative _bucket{le="..."} samples of `metric`, optionally filtered by an
// extra label match. Linear interpolation within the matching bucket, same as
// Prometheus' histogram_quantile(). Returns seconds, or undefined if no data.
export const histogramQuantile = (
  m: ParsedMetrics | undefined,
  metric: string,
  q: number,
  match?: (labels: Record<string, string>) => boolean
): number | undefined => {
  if (!m) return undefined;
  const buckets = (m.byName.get(metric + "_bucket") ?? [])
    .filter((s) => (match ? match(s.labels) : true))
    .map((s) => ({ le: s.labels.le, count: s.value }))
    .filter((b) => b.le !== undefined);
  if (buckets.length === 0) return undefined;

  // Aggregate counts per le across all matching label sets (sum series).
  const byLe = new Map<string, number>();
  for (const b of buckets) {
    byLe.set(b.le, (byLe.get(b.le) ?? 0) + b.count);
  }
  const ordered = [...byLe.entries()]
    .map(([le, count]) => ({ le: le === "+Inf" ? Infinity : parseFloat(le), count }))
    .sort((a, b) => a.le - b.le);
  if (ordered.length === 0) return undefined;

  const total = ordered[ordered.length - 1].count;
  if (total <= 0) return undefined;
  const rank = q * total;

  let prevLe = 0;
  let prevCount = 0;
  for (const b of ordered) {
    if (b.count >= rank) {
      if (b.le === Infinity) return prevLe;
      const bucketCount = b.count - prevCount;
      if (bucketCount <= 0) return b.le;
      // Linear interpolation within [prevLe, le].
      return prevLe + ((rank - prevCount) / bucketCount) * (b.le - prevLe);
    }
    prevLe = b.le === Infinity ? prevLe : b.le;
    prevCount = b.count;
  }
  return prevLe;
};

// expiryToISO maps an admin-token expiry preset to an ISO timestamp.
export const expiryToISO = (
  preset: string
): { expiration: string | null; neverExpires: boolean } => {
  if (preset === "never") return { expiration: null, neverExpires: true };
  const days = ({ "7d": 7, "30d": 30, "90d": 90 } as Record<string, number>)[preset];
  if (days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return { expiration: d.toISOString(), neverExpires: false };
  }
  return { expiration: new Date(preset).toISOString(), neverExpires: false };
};
