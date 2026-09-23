import type { AppData, SessionTag } from "../domain/types";
import { SESSION_TAG_OPTIONS } from "../domain/sessionTags";
import { recordBackupDownloaded } from "./backupReminder";

const tagLabel = new Map<SessionTag, string>(
  SESSION_TAG_OPTIONS.map(({ value, label }) => [value, label])
);

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export function makeBackup(data: AppData) {
  const { sync, ...trainingData } = data;
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    appData: trainingData,
    conflictArchive: sync ? [...sync.archive, ...sync.conflicts] : undefined
  };
}

export function makeSessionsCsv(data: AppData): string {
  const rows = [
    [
      "scenario",
      "date",
      "target_seconds",
      "actual_seconds",
      "outcome",
      "stopped_early",
      "stop_reason",
      "observed_signals",
      "context_tags",
      "warmup_reviews",
      "note"
    ]
  ];

  for (const scenario of data.scenarios) {
    for (const session of scenario.sessions) {
      rows.push([
        scenario.label,
        new Date(session.at).toISOString(),
        String(session.targetSeconds),
        String(session.actualSeconds),
        session.outcome,
        session.stoppedEarly ? "yes" : "no",
        session.stopReason,
        session.signals.join("; "),
        session.tags.map((tag) => tagLabel.get(tag) ?? tag).join("; "),
        (session.practiceReviews ?? [])
          .map((review) => `${review.actualSeconds}s ${review.outcome}`)
          .join("; "),
        session.note
      ]);
    }
  }

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

export function downloadBackup(data: AppData) {
  downloadText(
    `settledsolo-backup-${dateStamp()}.json`,
    JSON.stringify(makeBackup(data), null, 2),
    "application/json"
  );
  recordBackupDownloaded();
}

export function downloadSessionsCsv(data: AppData) {
  downloadText(
    `settledsolo-history-${dateStamp()}.csv`,
    makeSessionsCsv(data),
    "text/csv;charset=utf-8"
  );
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** The palette tokens the summary styles use, resolved from the live page. */
const SUMMARY_TOKENS = ["--ink", "--muted", "--line", "--paper", "--page", "--display", "--rose-soft", "--glow"];

/**
 * Only the summary's own rules (including its print rules) travel with the file,
 * read from the app's same-origin stylesheets so the two cannot drift apart.
 */
function summaryStyles(): string {
  const root = getComputedStyle(document.documentElement);
  const tokens = SUMMARY_TOKENS.map((name) => `${name}: ${root.getPropertyValue(name).trim()};`).join(" ");
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let cssRules: CSSRuleList;
    try {
      cssRules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(cssRules)) {
      if (rule.cssText.includes(".summary-")) rules.push(rule.cssText);
    }
  }
  return [
    `:root { ${tokens} }`,
    'body { margin: 0; padding: 24px 16px; background: var(--page); color: var(--ink); font-family: "Karla", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }',
    "h1, h2 { font-family: var(--display); font-weight: 560; }",
    ...rules
  ].join("\n");
}

/**
 * A standalone copy of the professional summary. It is built from the rendered
 * summary (so owner text is already escaped) and saved as a file for sharing
 * where printing is unavailable, such as some installed iPhone web apps.
 */
export function downloadSummaryPage(sheet: HTMLElement, title: string) {
  const html = [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${summaryStyles()}</style>`,
    "</head>",
    `<body>${sheet.outerHTML}</body>`,
    "</html>"
  ].join("\n");
  downloadText(`settledsolo-summary-${dateStamp()}.html`, html, "text/html;charset=utf-8");
}
