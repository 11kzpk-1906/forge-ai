const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

export function getApiBaseUrl(): string {
  const browserProtocol =
    typeof window !== "undefined" ? window.location.protocol : "";
  const browserHostname =
    typeof window !== "undefined" ? window.location.hostname : "";
  const isHttpBrowser = browserProtocol === "https:" || browserProtocol === "http:";
  const isLocalBrowser =
    browserHostname === "localhost" || browserHostname === "127.0.0.1";

  // Prefer an explicitly configured API URL. Hosted deployments should set
  // VITE_API_URL to their deployed HTTPS backend (for example, Render).
  if (configuredApiUrl) {
    let parsed: URL;
    try {
      parsed = new URL(configuredApiUrl);
    } catch {
      throw new Error("VITE_API_URL must be a valid absolute URL.");
    }

    const isLocalDevelopmentHost =
      parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";

    if (
      parsed.protocol !== "https:" &&
      !(import.meta.env.DEV && isLocalDevelopmentHost && parsed.protocol === "http:")
    ) {
      throw new Error("ForgeAI requires HTTPS for API requests outside local development.");
    }

    return parsed.toString().replace(/\/+$/, "");
  }

  // Keep the local development default when no API URL is configured.
  if (import.meta.env.DEV) return "http://127.0.0.1:8000";

  // Hosted browser builds can use the same-origin Vercel /api rewrite as a fallback.
  if (import.meta.env.PROD && isHttpBrowser && !isLocalBrowser) {
    return window.location.origin;
  }

  throw new Error(
    "ForgeAI API URL is not configured. Set VITE_API_URL to your deployed HTTPS API URL, then rebuild the app.",
  );
}
