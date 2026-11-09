// Field names match service/diagnostics/models.py exactly.

export type Confidence = "confirmed" | "probable" | "possible" | "insufficient";
export type Tone = "good" | "neutral" | "warning" | "critical";
export type RecoveryTone = "good" | "warning" | "serious";
export type StageState = "ok" | "fail" | "skip" | "unknown" | "active";

export const CONFIDENCE_ORDER: Confidence[] = ["insufficient", "possible", "probable", "confirmed"];

export interface Generation {
  inference_id: string;
  jobrouter_job_id?: string | null;
  unit_session_id?: string | null;
  org_id?: string;
  model_path: string;
  model_label?: string;
  status: string;
  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  error?: string | null;
  error_message?: string | null;
  error_detail?: { raw_error?: string | null } | null;
  notice_code?: string | null;
  http_status?: number | null;
  timeline?: [string, string][];
  provider_status?: string;
  credits_estimated?: number;
}

export interface Subject {
  inference_id: string;
  jobrouter_job_id: string | null;
  unit_session_id: string | null;
  model_label: string;
  provider: string;
}

export interface EvidenceItem {
  id: string;
  time: string | null;
  source: string;
  text: string;
}

export interface DiagnosisReport {
  id: string;
  created_at: string;
  subject: Subject;
  status_label: string;
  tone: Tone;
  diagnostic_code: string;
  category: string;
  confidence: Confidence;
  failure_stage: string;
  summary: string;
  cause: string;
  stages: { name: string; state: StageState }[];
  evidence: EvidenceItem[];
  steps: string[];
  recovery: { label: string; tone: RecoveryTone };
  actions: string[];
  credits_note: string;
  platform_notice: string | null;
  other_candidates: string[];
  missing_information: string[];
  explained_by: "rules" | "ai";
}

export interface SessionCandidate {
  inference_id: string;
  model_label: string;
  status: string;
  created_at: string;
}

export type AnalyzeResponse =
  | { kind: "diagnosis"; report: DiagnosisReport }
  | { kind: "session"; session: { unit_session_id: string; title: string }; candidates: SessionCandidate[] };

export interface Matcher {
  field: string;
  in?: (string | number)[];
  regex?: string;
  captures?: string[];
  confidence?: Confidence;
}

export interface Rule {
  code: string;
  category: string;
  title: string;
  tone: Tone;
  confidence: Confidence;
  stage: string;
  owner: string;
  retryable: string;
  match: Matcher[];
  summary: string;
  cause: string;
  cause_fallback?: string;
  steps: string[];
  recovery: { label: string; tone: RecoveryTone };
  actions: string[];
  credits: string;
}

export interface RulesDoc {
  version: number;
  rules: Rule[];
  fallback: Omit<Rule, "match">;
  platform_notice_threshold: number;
}

export type PlatformCounts = Record<string, { count: number; orgs: number }>;
