// Mirror of service/diagnostics/engine.py. Both are checked against shared/expected-diagnoses.json.

import { redact } from "./redact";
import type { Confidence, DiagnosisReport, EvidenceItem, Generation, PlatformCounts, Rule, RulesDoc, StageState } from "./types";

const STAGE_NAMES = ["Submitted", "Checks", "Queued", "Provider", "Delivered"];
const WAITING = new Set(["queued", "dispatching", "dispatched", "pending", "starting"]);
const PROVIDERS: Record<string, string> = {
  "fal-ai": "FAL",
  replicate: "Replicate",
  minimax: "MiniMax",
  runway: "Runway",
  google: "Google",
  gemini: "Google Gemini",
  openai: "OpenAI",
  worldlabs: "World Labs",
  bytedance: "ByteDance",
  comfyui: "ComfyUI",
};

export const clock = (iso?: string | null): string | null => (iso ? new Date(iso).toISOString().slice(11, 19) : null);

export function fmtDuration(seconds: number | null): string {
  if (seconds === null) return "an unknown time";
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const r = seconds % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}

export function fmtNumber(value: string): string {
  const n = Number(value);
  if (value.trim() === "" || Number.isNaN(n)) return value;
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export function providerFor(modelPath: string): string {
  const head = (modelPath || "").split("/")[0].toLowerCase();
  return PROVIDERS[head] ?? (head ? head[0].toUpperCase() + head.slice(1) : "Unknown");
}

export function errorText(g: Generation): string {
  return [g.error, g.error_message, g.error_detail?.raw_error].filter(Boolean).join(" · ");
}

type Facts = Record<string, string | number | null>;

export function buildFacts(g: Generation): Facts {
  const created = g.created_at ? Date.parse(g.created_at) : null;
  const completed = g.completed_at ? Date.parse(g.completed_at) : null;
  const duration = created !== null && completed !== null ? Math.floor((completed - created) / 1000) : null;
  return {
    status: (g.status || "").toLowerCase(),
    error_text: errorText(g),
    notice_code: g.notice_code ? g.notice_code.toLowerCase() : null,
    http_status: g.http_status ?? null,
    model: g.model_label || g.model_path || "this model",
    provider: providerFor(g.model_path),
    duration: fmtDuration(duration),
  };
}

const compiled = new WeakMap<object, RegExp>();
interface Match { rule: Rule; confidence: Confidence; captures: Record<string, string> }

export function matchRules(doc: RulesDoc, facts: Facts): Match[] {
  const out: Match[] = [];
  for (const rule of doc.rules) {
    for (const m of rule.match) {
      const value = facts[m.field];
      let captures: Record<string, string> | null = null;
      if (m.in) {
        if (value !== null && value !== undefined && m.in.includes(value)) captures = {};
      } else if (m.regex) {
        let re = compiled.get(m);
        if (!re) compiled.set(m, (re = new RegExp(m.regex, "i")));
        const found = re.exec(String(value ?? ""));
        if (found) {
          captures = {};
          (m.captures ?? []).forEach((name, i) => {
            if (found[i + 1]) captures![name] = found[i + 1];
          });
        }
      }
      if (captures) {
        out.push({ rule, confidence: m.confidence ?? rule.confidence, captures });
        break;
      }
    }
  }
  return out;
}

function fill(template: string, values: Record<string, unknown>): [string, boolean] {
  let missing = false;
  const text = template.replace(/\{([a-z_]+)\}/g, (_, key: string) => {
    const v = values[key];
    if (v === null || v === undefined || v === "") {
      missing = true;
      return "unknown";
    }
    return String(v);
  });
  return [text, missing];
}

function stagesFor(code: string, stage: string, status: string, g: Generation): StageState[] {
  if (code === "STATUS.IN_PROGRESS") return WAITING.has(status) ? ["ok", "ok", "active", "skip", "skip"] : ["ok", "ok", "ok", "active", "skip"];
  if (code === "STOPPED.CANCELLED") return ["ok", "ok", "ok", "skip", "skip"];
  switch (stage) {
    case "none": return ["ok", "ok", "ok", "ok", "ok"];
    case "credit_check":
    case "submission": return ["ok", "fail", "skip", "skip", "skip"];
    case "queue": return ["ok", "ok", "fail", "skip", "skip"];
    case "provider": return ["ok", "ok", "ok", "fail", "skip"];
    case "delivery": return ["ok", "ok", "ok", g.provider_status === "succeeded" ? "ok" : "unknown", "fail"];
    default: return ["ok", "ok", g.started_at ? "ok" : "unknown", "unknown", "skip"];
  }
}

function newId(): string {
  return Math.random().toString(16).slice(2, 14).padEnd(12, "0");
}

export function diagnoseGeneration(g: Generation, doc: RulesDoc, counts: PlatformCounts = {}, now = new Date()): DiagnosisReport {
  const facts = buildFacts(g);
  const matches = matchRules(doc, facts);
  const chosen = matches[0];
  const rule = chosen ? chosen.rule : (doc.fallback as Rule);
  const confidence = chosen ? chosen.confidence : doc.fallback.confidence;
  const captures = chosen ? chosen.captures : {};
  const code = rule.code;
  const isStatus = code.startsWith("STATUS.") || code.startsWith("STOPPED.");

  const platform = !isStatus ? counts[code] : undefined;
  const values: Record<string, unknown> = { ...facts };
  for (const [k, v] of Object.entries(captures)) values[k] = k === "required" || k === "available" ? fmtNumber(v) : v;
  if (platform) Object.assign(values, { same_count: platform.count, same_orgs: platform.orgs });

  const [summary] = fill(rule.summary, values);
  let [cause, missing] = fill(rule.cause, values);
  if (missing && rule.cause_fallback) cause = rule.cause_fallback;

  const evidence: EvidenceItem[] = [];
  const add = (time: string | null, source: string, text: string) => evidence.push({ id: `ev${evidence.length + 1}`, time, source, text });
  const shown = redact(errorText(g));
  if (shown) add(clock(g.completed_at), "Generation record", `Error: ${shown}`);
  if (facts.notice_code) add(clock(g.completed_at), "Failure code", `Recorded code: ${facts.notice_code}`);
  if (facts.http_status) add(clock(g.completed_at), "Provider response", `HTTP status ${facts.http_status}`);
  const timeline = g.timeline ?? [];
  if (timeline.length) add(clock(timeline[0][0]), "Job status history", timeline.map(([t, s]) => `${s} ${clock(t)}`).join(" → "));
  else add(null, "Job status history", "No job history is available for this generation.");
  const done = facts.status === "completed" || facts.status === "succeeded";
  if (done) add(clock(g.completed_at), "Generation record", `Completed with output after ${facts.duration}.`);
  if (platform) add("last 60 min", "Platform", `${platform.count} similar failures in the last hour across ${platform.orgs} workspaces.`);

  const missingInfo: string[] = [];
  if (!timeline.length) missingInfo.push("Job Router history for this job");
  if (g.provider_status === "unknown" && !done) missingInfo.push("Provider-side status (did the provider finish?)");
  if (code === "UNKNOWN") missingInfo.push("A recorded error message");

  const threshold = doc.platform_notice_threshold ?? 5;
  const failed = (rule.tone === "critical" || rule.tone === "warning") && !isStatus;
  const states = stagesFor(code, rule.stage, String(facts.status), g);

  return {
    id: newId(),
    created_at: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    subject: {
      inference_id: g.inference_id,
      jobrouter_job_id: g.jobrouter_job_id ?? null,
      unit_session_id: g.unit_session_id ?? null,
      model_label: String(facts.model),
      provider: String(facts.provider),
    },
    status_label: failed ? `Failed: ${rule.title}` : rule.title,
    tone: rule.tone,
    diagnostic_code: code,
    category: rule.category,
    confidence,
    failure_stage: rule.stage,
    summary,
    cause,
    stages: STAGE_NAMES.map((name, i) => ({ name, state: states[i] })),
    evidence,
    steps: [...rule.steps],
    recovery: { ...rule.recovery },
    actions: [...rule.actions],
    credits_note: rule.credits,
    platform_notice:
      platform && platform.count >= threshold
        ? `Platform issue in progress: ${platform.count} similar failures in the last hour across ${platform.orgs} workspaces. The team has been notified.`
        : null,
    other_candidates: matches.slice(1).map((m) => m.rule.code),
    missing_information: missingInfo,
    explained_by: "rules",
  };
}
