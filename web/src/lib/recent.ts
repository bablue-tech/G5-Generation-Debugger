import type { DiagnosisReport } from "./types";

export interface RecentItem {
  inference_id: string;
  status_label: string;
  tone: DiagnosisReport["tone"];
  model_label: string;
  at: string;
}

const KEY = "g5-debugging-recent";

export function loadRecent(): RecentItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function pushRecent(report: DiagnosisReport): RecentItem[] {
  const item: RecentItem = {
    inference_id: report.subject.inference_id,
    status_label: report.status_label,
    tone: report.tone,
    model_label: report.subject.model_label,
    at: report.created_at,
  };
  const next = [item, ...loadRecent().filter((r) => r.inference_id !== item.inference_id)].slice(0, 8);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  return next;
}
