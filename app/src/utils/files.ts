export function fileNameFromUri(uri: string, fallback: string): string {
  const parts = uri.split("/");
  const raw = parts[parts.length - 1] ?? "";
  const cleaned = decodeURIComponent(raw).split("?")[0]?.trim() ?? "";
  return cleaned || fallback;
}

export function normalizeFilePath(uri: string): string {
  if (uri.startsWith("file://")) return decodeURIComponent(uri.replace("file://", ""));
  return decodeURIComponent(uri);
}
