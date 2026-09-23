const configuredSupportUrl = (import.meta.env.VITE_SUPPORT_URL ?? "").trim();
/** The owner's Ko-fi page; `VITE_SUPPORT_URL` overrides it per deployment. */
export const DEFAULT_SUPPORT_URL = "https://ko-fi.com/settledsolo";

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
 * The owner-approved link, unless a deployment configures a different https
 * link. An invalid override falls back rather than shipping a broken link.
 */
export const supportUrl = safeSupportUrl(configuredSupportUrl) ?? DEFAULT_SUPPORT_URL;
export const supportProvider = supportProviderName(supportUrl);
