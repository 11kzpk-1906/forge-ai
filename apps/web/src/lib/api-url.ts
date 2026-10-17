const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

/**
 * Resolve the API URL explicitly. Development may use the local FastAPI server,
 * but production builds must be configured with a deployed API URL rather than
 * silently attempting to call localhost on every user's machine.
 */
export function getApiBaseUrl(): string {
  if (configuredApiUrl) {
    return configuredApiUrl.replace(/\/+$/, "");
  }

  if (import.meta.env.DEV) {
    return "http://127.0.0.1:8000";
  }

  throw new Error(
    "ForgeAI API URL is not configured. Set VITE_API_URL to your deployed HTTPS API URL, then rebuild the app.",
  );
}
