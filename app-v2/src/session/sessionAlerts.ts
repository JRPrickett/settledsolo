export type NotificationPermissionState =
  | "unsupported"
  | NotificationPermission;

export interface AlertCapabilities {
  notifications: NotificationPermissionState;
  push: boolean;
  wakeLock: boolean;
}

let audioContext: AudioContext | null = null;
let wakeLock: WakeLockSentinel | null = null;
let fallbackClientId: string | null = null;

const PUSH_CLIENT_ID_KEY = "settledsolo-push-client-v1";

function context(): AudioContext | null {
  const Ctor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;

  if (!audioContext) {
    try {
      audioContext = new Ctor();
    } catch {
      return null;
    }
  }

  if (audioContext.state === "suspended") {
    void audioContext.resume().catch(() => {});
  }
  return audioContext;
}

function tone(
  frequency: number,
  delaySeconds: number,
  durationSeconds: number,
  gainValue: number
) {
  const ctx = context();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + delaySeconds;
  const end = start + durationSeconds;

  oscillator.frequency.value = frequency;
  oscillator.type = "sine";
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.03);
}

export function playHeadBackSoonChime() {
  tone(520, 0, 0.38, 0.11);
  tone(660, 0.18, 0.42, 0.10);
  tone(820, 0.40, 0.48, 0.09);
}

export function playTargetReachedChime() {
  tone(660, 0, 0.72, 0.13);
  tone(990, 0, 0.62, 0.07);
  tone(880, 0.36, 0.9, 0.12);
  tone(1320, 0.36, 0.76, 0.06);
}

function pushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof fetch === "function"
  );
}

export function alertCapabilities(): AlertCapabilities {
  return {
    notifications:
      typeof Notification === "undefined"
        ? "unsupported"
        : Notification.permission,
    push: pushSupported(),
    wakeLock: "wakeLock" in navigator
  };
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;

  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
  if (wakeLock && !wakeLock.released) return;

  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch {
    wakeLock = null;
  }
}

export function prepareSessionAudio() {
  // Unlock Web Audio from the user's tap so foreground chimes can play later.
  // Do not keep a looping media element alive: that creates a fake media
  // session on iOS and makes the Lock Screen behave like an audio player.
  context();
  void requestWakeLock();
}

function decodeApplicationServerKey(value: string): ArrayBuffer {
  const normal = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normal + "=".repeat((4 - (normal.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function equalKeys(left: ArrayBuffer | null, right: ArrayBuffer): boolean {
  if (!left || left.byteLength !== right.byteLength) return false;
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}

async function pushConfig(): Promise<{ enabled: boolean; publicKey: string | null }> {
  try {
    const response = await fetch("/api/push/config", {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) return { enabled: false, publicKey: null };
    const body = (await response.json()) as {
      enabled?: unknown;
      publicKey?: unknown;
    };
    return {
      enabled: body.enabled === true,
      publicKey: typeof body.publicKey === "string" ? body.publicKey : null
    };
  } catch {
    return { enabled: false, publicKey: null };
  }
}

async function ensurePushSubscription(): Promise<PushSubscription | null> {
  if (
    !pushSupported() ||
    typeof Notification === "undefined" ||
    Notification.permission !== "granted"
  ) {
    return null;
  }

  const config = await pushConfig();
  if (!config.enabled || !config.publicKey) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    const applicationServerKey = decodeApplicationServerKey(config.publicKey);
    let subscription = await registration.pushManager.getSubscription();

    if (
      subscription &&
      !equalKeys(subscription.options.applicationServerKey, applicationServerKey)
    ) {
      await subscription.unsubscribe();
      subscription = null;
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
    }

    return subscription;
  } catch {
    return null;
  }
}

export async function prepareBackgroundReturnAlerts(): Promise<boolean> {
  return Boolean(await ensurePushSubscription());
}

function randomOpaqueId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random()
    .toString(36)
    .slice(2)}`;
}

function pushClientId(): string {
  if (fallbackClientId) return fallbackClientId;

  try {
    const existing = localStorage.getItem(PUSH_CLIENT_ID_KEY);
    if (existing) {
      fallbackClientId = existing;
      return existing;
    }

    const created = randomOpaqueId();
    localStorage.setItem(PUSH_CLIENT_ID_KEY, created);
    fallbackClientId = created;
    return created;
  } catch {
    fallbackClientId = randomOpaqueId();
    return fallbackClientId;
  }
}

export function createReturnAlertToken(): string {
  return randomOpaqueId();
}

export async function scheduleBackgroundReturnAlert(
  targetAt: number,
  sessionToken: string
): Promise<boolean> {
  const subscription = await ensurePushSubscription();
  if (!subscription) return false;

  try {
    const response = await fetch("/api/push/schedule", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        clientId: pushClientId(),
        sessionToken,
        endpoint: subscription.endpoint,
        targetAt
      }),
      keepalive: true
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function cancelBackgroundReturnAlert(
  sessionToken: string
): Promise<void> {
  try {
    await fetch("/api/push/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        clientId: pushClientId(),
        sessionToken
      }),
      keepalive: true
    });
  } catch {
    // Cancellation is best effort; the push itself has a short TTL to avoid
    // stale reminders being delivered long after a session has ended.
  }
}

export function stopSessionAlerts() {
  if (wakeLock && !wakeLock.released) {
    void wakeLock.release().catch(() => {});
  }
  wakeLock = null;
}

export function installWakeLockRecovery(): () => void {
  const recover = () => {
    if (document.visibilityState === "visible") void requestWakeLock();
  };
  document.addEventListener("visibilitychange", recover);
  return () => document.removeEventListener("visibilitychange", recover);
}
