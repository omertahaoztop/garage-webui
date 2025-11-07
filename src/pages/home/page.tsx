import Page from "@/context/page-context";
import { useNodesHealth } from "./hooks";
import StatsCard from "./components/stats-card";
import {
  Database,
  DatabaseZap,
  FileBox,
  FileCheck,
  FileClock,
  HardDrive,
  HardDriveUpload,
  Leaf,
  PieChart,
} from "lucide-react";
import { cn, readableBytes, ucfirst } from "@/lib/utils";
import { useBuckets } from "../buckets/hooks";
import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";

const HomePage = () => {
  const { isAdmin } = useAuth();
  const { data: health } = useNodesHealth({ enabled: isAdmin });
  const { data: buckets } = useBuckets();

  const { totalUsage, totalObjects, unfinishedUploads } = useMemo(() => {
    return buckets?.reduce(
      (acc, bucket) => {
        acc.totalUsage += bucket.bytes;
        acc.totalObjects += bucket.objects;
        acc.unfinishedUploads +=
          bucket.unfinishedUploads + bucket.unfinishedMultipartUploads;
        return acc;
      },
      { totalUsage: 0, totalObjects: 0, unfinishedUploads: 0 }
    ) ?? { totalUsage: 0, totalObjects: 0, unfinishedUploads: 0 };
  }, [buckets]);

  const bucketCount = buckets?.length ?? 0;

  if (!isAdmin) {
    return (
      <div className="container">
        <Page title="Dashboard" />

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <StatsCard title="Buckets" icon={Database} value={bucketCount} />
          <StatsCard
            title="Objects"
            icon={FileBox}
            value={totalObjects.toLocaleString()}
          />
          <StatsCard
            title="Total Usage"
            icon={PieChart}
            value={readableBytes(totalUsage)}
          />
          <StatsCard
            title="Unfinished Uploads"
            icon={FileClock}
            value={unfinishedUploads.toLocaleString()}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="container">
      <Page title="Dashboard" />

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <StatsCard
          title="Status"
          icon={Leaf}
          value={ucfirst(health?.status)}
          valueClassName={cn(
            "text-lg",
            health?.status === "healthy"
              ? "text-success"
              : health?.status === "degraded"
                ? "text-warning"
                : "text-error"
          )}
        />
        <StatsCard title="Nodes" icon={HardDrive} value={health?.knownNodes} />
        <StatsCard
          title="Connected Nodes"
          icon={HardDriveUpload}
          value={health?.connectedNodes}
        />
        <StatsCard
          title="Storage Nodes"
          icon={Database}
          value={health?.storageNodes}
        />
        <StatsCard
          title="Active Storage Nodes"
          icon={DatabaseZap}
          value={health?.storageNodesUp}
        />
        <StatsCard
          title="Partitions"
          icon={FileBox}
          value={health?.partitions}
        />
        <StatsCard
          title="Partitions Quorum"
          icon={FileClock}
          value={health?.partitionsQuorum}
        />
        <StatsCard
          title="Active Partitions"
          icon={FileCheck}
          value={health?.partitionsAllOk}
        />
        <StatsCard
          title="Total Usage"
          icon={PieChart}
          value={readableBytes(totalUsage)}
        />
      </section>
    </div>
  );
};

export default HomePage;
