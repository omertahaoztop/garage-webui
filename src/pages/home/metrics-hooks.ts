import { API_URL } from "@/lib/api";
import clusterStore from "@/stores/cluster-store";
import { useQuery } from "@tanstack/react-query";

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
const parsePrometheus = (text: string): ParsedMetrics => {
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

const fetchMetrics = async (): Promise<ParsedMetrics> => {
  const headers: Record<string, string> = {};
  const cid = clusterStore.getActiveId();
  if (cid) headers["X-Cluster-Id"] = cid;

  const res = await fetch(API_URL + "/admin/metrics", {
    credentials: "include",
    headers,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `metrics scrape failed (${res.status})`);
  }
  const text = await res.text();
  return parsePrometheus(text);
};

export const useMetrics = (enabled = true) =>
  useQuery({
    queryKey: ["metrics"],
    queryFn: fetchMetrics,
    enabled,
    refetchInterval: 10000,
    retry: false,
  });

// Helpers to pull common Garage metric aggregates out of parsed samples.
export const sumMetric = (m: ParsedMetrics | undefined, name: string): number => {
  if (!m) return 0;
  return (m.byName.get(name) ?? []).reduce((acc, s) => acc + s.value, 0);
};

export const firstMetric = (
  m: ParsedMetrics | undefined,
  name: string
): number | undefined => m?.byName.get(name)?.[0]?.value;
