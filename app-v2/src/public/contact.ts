const configuredContactEmail = (import.meta.env.VITE_CONTACT_EMAIL ?? "").trim();
const DEFAULT_CONTACT_EMAIL = "jason@southwestwebsites.co.uk";

// Deliberately strict: this value becomes a mailto link on every public page.
const SIMPLE_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// Deployments may override this; use the owner-approved contact when unset or invalid.
export const contactEmail = SIMPLE_EMAIL.test(configuredContactEmail)
  ? configuredContactEmail
  : DEFAULT_CONTACT_EMAIL;

export interface FeedbackContext {
  installed: boolean;
  storage: "device" | "limited";
}

/**
 * A prefilled feedback email. It carries only coarse technical context the owner
 * can read and edit before sending; never the dog's name or any training record.
 */
export function feedbackMailto(address: string, context?: FeedbackContext): string {
  const lines = [
    "What happened, or what would make SettledSolo more useful?",
    "",
    "",
    "What did you expect instead?",
    "",
    ""
  ];
  if (context) {
    lines.push(
      "---",
      "Technical details (edit or remove anything you prefer not to share):",
      `App mode: ${context.installed ? "installed app" : "browser tab"}`,
      `Storage: ${context.storage === "device" ? "saved on this device" : "limited or temporary"}`,
      `Browser: ${typeof navigator === "undefined" ? "unknown" : navigator.userAgent}`
    );
  }
  const params = new URLSearchParams({
    subject: "SettledSolo beta feedback",
    body: lines.join("\n")
  });
  // URLSearchParams encodes spaces as "+", which mail clients show literally.
  return `mailto:${address}?${params.toString().replace(/\+/g, "%20")}`;
}
