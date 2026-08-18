const BACKEND_URL = "http://127.0.0.1:8000";

export function getMediaUrl(
  url?: string | null
): string | undefined {
  if (!url) {
    return undefined;
  }

  if (
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    return url;
  }

  return `${BACKEND_URL}${url}`;
}