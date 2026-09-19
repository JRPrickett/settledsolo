import type { ObservedSignal } from "./types";

/**
 * Typed as a complete record, so adding a signal to the union without giving it
 * a label is a compile error rather than a raw value leaking into the UI.
 */
const OBSERVED_SIGNAL_LABELS: Record<ObservedSignal, string> = {
  "exit-watching": "Watching the exit",
  pacing: "Pacing",
  panting: "Panting",
  whining: "Whining",
  "barking-howling": "Barking / howling",
  "unable-to-settle": "Unable to settle",
  // Refusing food that would normally be taken is a practitioner-recognised sign
  // that a dog is above threshold. Only meaningful when food was actually left.
  "food-refusal": "Refused food or treats"
};

export const OBSERVED_SIGNAL_VALUES = Object.keys(
  OBSERVED_SIGNAL_LABELS
) as ObservedSignal[];

export const observedSignalOptions: Array<{
  value: ObservedSignal;
  label: string;
}> = OBSERVED_SIGNAL_VALUES.map((value) => ({
  value,
  label: OBSERVED_SIGNAL_LABELS[value]
}));

export function observedSignalLabel(signal: ObservedSignal): string {
  return OBSERVED_SIGNAL_LABELS[signal];
}
