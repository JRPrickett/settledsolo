const configuredSupportUrl = (import.meta.env.VITE_SUPPORT_URL ?? "").trim();

export function safeSupportUrl(value: string): string | null {
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

const KNOWN_PROVIDERS: Array<{ host: string; name: string }> = [
  { host: "ko-fi.com", name: "Ko-fi" },
  { host: "buymeacoffee.com", name: "Buy Me a Coffee" }
];

/** The provider named in the privacy notice and on the support card. */
export function supportProviderName(url: string): string {
  const host = new URL(url).hostname.toLowerCase();
  const known = KNOWN_PROVIDERS.find(
    (provider) => host === provider.host || host.endsWith(`.${provider.host}`)
  );
  return known?.name ?? "our support provider";
}

/**
 * Optional support is configured at deploy time so the product never ships a
 * guessed provider account or a broken payment link.
 */
export const supportUrl = safeSupportUrl(configuredSupportUrl);
export const supportProvider = supportUrl ? supportProviderName(supportUrl) : null;
