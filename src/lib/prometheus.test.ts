import { describe, it, expect } from "vitest";
import { parsePrometheus, sumMetric, firstMetric, expiryToISO } from "./prometheus";

describe("parsePrometheus", () => {
  it("parses bare metrics", () => {
    const m = parsePrometheus("cluster_healthy 1\ncluster_storage_nodes_ok 3");
    expect(firstMetric(m, "cluster_healthy")).toBe(1);
    expect(firstMetric(m, "cluster_storage_nodes_ok")).toBe(3);
  });

  it("skips HELP/TYPE comment lines and blanks", () => {
    const text = [
      "# HELP cluster_healthy whether healthy",
      "# TYPE cluster_healthy gauge",
      "",
      "cluster_healthy 0",
    ].join("\n");
    const m = parsePrometheus(text);
    expect(m.samples).toHaveLength(1);
    expect(firstMetric(m, "cluster_healthy")).toBe(0);
  });

  it("parses labels", () => {
    const m = parsePrometheus(
      'garage_local_disk_avail{volume="data"} 540\ngarage_local_disk_avail{volume="metadata"} 100'
    );
    const samples = m.byName.get("garage_local_disk_avail")!;
    expect(samples).toHaveLength(2);
    const dataVol = samples.find((s) => s.labels.volume === "data");
    expect(dataVol?.value).toBe(540);
  });

  it("sums repeated metric names across labels", () => {
    const m = parsePrometheus(
      'api_s3_request_counter{api_endpoint="GetObject"} 10\napi_s3_request_counter{api_endpoint="PutObject"} 5'
    );
    expect(sumMetric(m, "api_s3_request_counter")).toBe(15);
  });

  it("ignores non-numeric values", () => {
    const m = parsePrometheus("garage_build_info{version=\"1.0\"} NaNxyz");
    expect(m.samples).toHaveLength(0);
  });

  it("returns 0 from sumMetric for unknown metric", () => {
    const m = parsePrometheus("cluster_healthy 1");
    expect(sumMetric(m, "does_not_exist")).toBe(0);
  });

  it("firstMetric returns undefined for missing metric", () => {
    const m = parsePrometheus("cluster_healthy 1");
    expect(firstMetric(m, "missing")).toBeUndefined();
  });
});

describe("expiryToISO", () => {
  it("never -> null + neverExpires", () => {
    expect(expiryToISO("never")).toEqual({ expiration: null, neverExpires: true });
  });

  it("7d -> ~7 days out, not never", () => {
    const before = Date.now() + 6.5 * 86400_000;
    const after = Date.now() + 7.5 * 86400_000;
    const r = expiryToISO("7d");
    expect(r.neverExpires).toBe(false);
    const t = new Date(r.expiration!).getTime();
    expect(t).toBeGreaterThan(before);
    expect(t).toBeLessThan(after);
  });

  it("custom date string passes through as ISO", () => {
    const r = expiryToISO("2030-01-15");
    expect(r.neverExpires).toBe(false);
    expect(r.expiration).toContain("2030-01-15");
  });
});
