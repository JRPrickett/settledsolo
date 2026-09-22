const configuredSupportUrl = (import.meta.env.VITE_SUPPORT_URL ?? "").trim();

function isSafeSupportUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Optional support is configured at deploy time so the product never ships a
 * guessed provider account or a broken payment link.
 */
export const supportUrl = isSafeSupportUrl(configuredSupportUrl)
  ? configuredSupportUrl
  : null;
