import { api } from "../lib/api";

export function getMediaUrl(
  url?: string | null
): string | undefined {
  if (!url?.trim()) {
    return undefined;
  }

  try {
    const appOrigin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
    const backendOrigin = new URL(api.defaults?.baseURL || "/api/v1", appOrigin).origin;
    const resolved = new URL(url.trim(), `${backendOrigin}/`);
    return resolved.protocol === "http:" || resolved.protocol === "https:" ? resolved.href : undefined;
  } catch {
    return undefined;
  }
}
