import React, { useEffect, useState } from "react";

export function PendingAttachmentVideoPlayer({
  base64,
  onClose,
}: {
  base64: string;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    try {
      const bin = atob(base64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], { type: "video/webm" });
      const objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } catch {
      setUrl(null);
    }
  }, [base64]);
  if (!url) return null;
  return (
    <video
      src={url}
      controls
      playsInline
      style={{ maxWidth: "100%", maxHeight: "80vh", display: "block" }}
      onError={onClose}
    >
      Your browser does not support the video tag.
    </video>
  );
}
