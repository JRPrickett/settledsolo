export function createOpaqueId(prefix = ""): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}${crypto.randomUUID().replaceAll("-", "")}`;
  }
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return `${prefix}${Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("")}`;
  }
  throw new Error("Secure random values are unavailable.");
}
