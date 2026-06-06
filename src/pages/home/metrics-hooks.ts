import { API_URL } from "@/lib/api";
import clusterStore from "@/stores/cluster-store";
import { useQuery } from "@tanstack/react-query";
import {
  parsePrometheus,
  sumMetric,
  firstMetric,
  histogramQuantile,
  type ParsedMetrics,
  type MetricSample,
} from "@/lib/prometheus";

export type { ParsedMetrics, MetricSample };
export { sumMetric, firstMetric, histogramQuantile };

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

