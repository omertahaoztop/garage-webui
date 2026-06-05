import { createDisclosure } from "@/lib/disclosure";
import { Alert, Modal } from "react-daisyui";
import { useBucketContext } from "../context";
import { useConfig } from "@/hooks/useConfig";
import { useEffect, useMemo, useState } from "react";
import Input from "@/components/ui/input";
import Button from "@/components/ui/button";
import { Copy, FileWarningIcon } from "lucide-react";
import { copyToClipboard } from "@/lib/utils";
import Checkbox from "@/components/ui/checkbox";

export const shareDialog = createDisclosure<{ key: string; prefix: string }>();

const ShareDialog = () => {
  const { isOpen, data, dialogRef } = shareDialog.use();
  const { bucket, bucketName } = useBucketContext();
  const { data: config } = useConfig();
  const [domain, setDomain] = useState(bucketName);

  const websitePort = config?.s3_web?.bind_addr?.split(":").pop() || "80";
  // root_domain on a Garage server has a leading dot (e.g. ".web.garage.localhost").
  // Falling back to "" instead of `undefined` prevents the legacy
  // `http://webui-test/undefinedundefined` URL from rendering when no
  // website domain is configured. See gotcha b27.
  const rootDomain = config?.s3_web?.root_domain ?? "";

  const domains = useMemo(
    () => [
      bucketName,
      rootDomain ? bucketName + rootDomain : bucketName,
      rootDomain ? bucketName + rootDomain + `:${websitePort}` : bucketName,
    ],
    [bucketName, config?.s3_web]
  );

  useEffect(() => {
    setDomain(bucketName);
  }, [domains]);

  // data.prefix / data.key are typed optional — coalesce so we never serialise
  // the literal string "undefined" into the share URL.
  const prefix = data?.prefix ?? "";
  const key = data?.key ?? "";
  const url = "http://" + domain + "/" + prefix + key;

  return (
    <Modal ref={dialogRef} open={isOpen} backdrop>
      <Modal.Header className="truncate">Share {data?.key || ""}</Modal.Header>
      <Modal.Body>
        {!bucket.websiteAccess && (
          <Alert className="mb-4 items-start text-sm">
            <FileWarningIcon className="mt-1" />
            Sharing is only available for buckets with enabled website access.
          </Alert>
        )}
        <div className="flex flex-row overflow-x-auto pb-2">
          {domains.map((item) => (
            <Checkbox
              key={item}
              label={item}
              checked={item === domain}
              onChange={() => setDomain(item)}
            />
          ))}
        </div>
        <div className="relative mt-2">
          <Input
            value={url}
            className="w-full pr-12"
            onFocus={(e) => e.target.select()}
          />
          <Button
            icon={Copy}
            onClick={() => copyToClipboard(url)}
            className="absolute top-0 right-0"
            color="ghost"
          />
        </div>
      </Modal.Body>
      <Modal.Actions>
        <Button onClick={() => shareDialog.close()}>Close</Button>
      </Modal.Actions>
    </Modal>
  );
};

export default ShareDialog;
