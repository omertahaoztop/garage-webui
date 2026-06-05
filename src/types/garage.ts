export type Config = {
  metadata_dir: string;
  data_dir: string;
  db_engine: string;
  metadata_auto_snapshot_interval: string;
  replication_factor: number;
  compression_level: number;
  rpc_bind_addr: string;
  rpc_public_addr: string;
  rpc_secret: string;
  s3_api?: S3API;
  s3_web?: S3Web;
  admin?: Admin;
};

export type Admin = {
  api_bind_addr: string;
  admin_token: string;
  metrics_token: string;
};

export type S3API = {
  s3_region: string;
  api_bind_addr: string;
  root_domain: string;
};

export type S3Web = {
  bind_addr: string;
  root_domain: string;
  index: string;
};

// Multi-cluster types (FAZ 1 Sprint 1)
export type ClusterPublic = {
  id: string;
  name: string;
  adminUrl: string;
  s3Endpoint: string;
  s3Region: string;
  isDefault: boolean;
  hasToken: boolean;
};

export type ClustersResponse = {
  clusters: ClusterPublic[];
  defaultId: string;
};

export type ClusterHealth = {
  status: string; // "healthy" | "degraded" | "unavailable"
  knownNodes?: number;
  connectedNodes?: number;
  storageNodes?: number;
  storageNodesOk?: number;
  storageNodesUp?: number;
  partitions?: number;
  partitionsQuorum?: number;
  partitionsAllOk?: number;
};

export type ClusterTestResult = {
  id: string;
  ok: boolean;
  health?: ClusterHealth;
  error?: string;
};
