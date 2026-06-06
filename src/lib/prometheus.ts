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
    let labels: Record<string, string> = {};
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
