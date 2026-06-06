//

export type GetBucketRes = Bucket[];

export type Bucket = {
  id: string;
  globalAliases: string[];
  localAliases: LocalAlias[];
  websiteAccess: boolean;
  websiteConfig?: WebsiteConfig | null;
  keys: Key[];
  objects: number;
  bytes: number;
  unfinishedUploads: number;
  unfinishedMultipartUploads: number;
  unfinishedMultipartUploadParts: number;
  unfinishedMultipartUploadBytes: number;
  quotas: Quotas;
  corsRules?: CorsRule[] | null;
  lifecycleRules?: LifecycleRule[] | null;
};

export type LocalAlias = {
  accessKeyId: string;
  alias: string;
};

export type Key = {
  accessKeyId: string;
  name: string;
  permissions: Permissions;
  bucketLocalAliases: string[];
};

export type Permissions = {
  read: boolean;
  write: boolean;
  owner: boolean;
};

export type WebsiteConfig = {
  indexDocument: string;
  errorDocument: string;
};

export type Quotas = {
  maxSize: null;
  maxObjects: null;
};

export type CorsRule = {
  ID?: string | null;
  AllowedOrigin: string[];
  AllowedMethod: string[];
  AllowedHeader?: string[];
  ExposeHeader?: string[];
  MaxAgeSeconds?: number | null;
};

export type LifecycleRule = {
  ID?: string | null;
  Status: "Enabled" | "Disabled";
  Filter?: {
    Prefix?: string | null;
    ObjectSizeGreaterThan?: number | null;
    ObjectSizeLessThan?: number | null;
  } | null;
  Expiration?: {
    Days?: number | null;
    Date?: string | null;
  } | null;
  AbortIncompleteMultipartUpload?: {
    DaysAfterInitiation: number;
  } | null;
};
