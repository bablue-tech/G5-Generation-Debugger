import rulesJson from "../../../shared/diagnostic-rules.json";
import samplesJson from "../../../shared/sample-generations.json";
import { diagnoseGeneration } from "./engine";
import { parseReference, ReferenceError } from "./resolver";
import type { AnalyzeResponse, Generation, PlatformCounts, RulesDoc } from "./types";

export interface DiagnosticsSource {
  mode: "sample" | "live";
  analyze(reference: string): Promise<AnalyzeResponse>;
  escalate(diagnosisId: string, comment: string): Promise<{ ticket_id: string }>;
  feedback(diagnosisId: string, helpful: boolean, wrongCause: boolean): Promise<void>;
}

export class NotFoundError extends Error {}

const RULES = rulesJson as unknown as RulesDoc;
const SAMPLES = samplesJson as unknown as {
  sessions: { unit_session_id: string; title: string; inference_ids: string[]; org_id: string }[];
  generations: Generation[];
  platform_counts_last_60m: PlatformCounts;
};
const DEMO_ORG = "org-galleri5-studio";
const NOT_FOUND = "We couldn't find a generation you have access to.";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Runs the same rules as the service, in the browser, on sample data. */
export class SampleSource implements DiagnosticsSource {
  mode = "sample" as const;

  private visible(g?: Generation): Generation {
    if (!g || g.org_id !== DEMO_ORG) throw new NotFoundError(NOT_FOUND);
    return g;
  }

  async analyze(reference: string): Promise<AnalyzeResponse> {
    const ref = parseReference(reference);
    await wait(250);
    const byId = (id: string) => SAMPLES.generations.find((g) => g.inference_id === id);
    if (ref.kind === "session") {
      const session = SAMPLES.sessions.find((s) => s.unit_session_id === ref.id);
      if (!session || session.org_id !== DEMO_ORG) throw new NotFoundError(NOT_FOUND);
      const gens = session.inference_ids.map(byId).filter((g): g is Generation => !!g && g.org_id === DEMO_ORG);
      gens.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
      gens.sort((a, b) => rank(a.status) - rank(b.status));
      return {
        kind: "session",
        session: { unit_session_id: session.unit_session_id, title: session.title },
        candidates: gens.map((g) => ({
          inference_id: g.inference_id,
          model_label: g.model_label ?? g.model_path,
          status: g.status,
          created_at: g.created_at ?? "",
        })),
      };
    }
    const g = ref.kind === "job" ? SAMPLES.generations.find((x) => x.jobrouter_job_id === ref.id) : byId(ref.id);
    return { kind: "diagnosis", report: diagnoseGeneration(this.visible(g), RULES, SAMPLES.platform_counts_last_60m) };
  }

  async escalate(): Promise<{ ticket_id: string }> {
    await wait(400);
    return { ticket_id: `TCK-${Math.random().toString(16).slice(2, 8).toUpperCase()}` };
  }

  async feedback(): Promise<void> {}
}

const rank = (status: string) => (status === "failed" || status === "error" ? 0 : status === "canceled" || status === "cancelled" ? 1 : 2);

/** Calls the Python diagnostics service (service/app.py) or the real AI Studio backend. */
export class LiveSource implements DiagnosticsSource {
  mode = "live" as const;
  constructor(private baseUrl: string, private getToken: () => Promise<string | null> = async () => null) {}

  private async request<T>(path: string, body: unknown): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/api/v1/diagnostics${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => null);
    if (res.status === 404) throw new NotFoundError(data?.detail ?? NOT_FOUND);
    if (res.status === 422) throw new ReferenceError(typeof data?.detail === "string" ? data.detail : "That link couldn't be read.");
    if (res.status === 429) throw new Error("Too many diagnoses in a short time. Try again in a minute.");
    if (!res.ok) throw new Error(data?.detail ?? `Diagnostics service error (${res.status}).`);
    return data as T;
  }

  analyze(reference: string) {
    return this.request<AnalyzeResponse>("", { reference });
  }
  escalate(diagnosisId: string, comment: string) {
    return this.request<{ ticket_id: string }>(`/${encodeURIComponent(diagnosisId)}/escalate`, { comment: comment || null });
  }
  async feedback(diagnosisId: string, helpful: boolean, wrongCause: boolean) {
    await this.request<void>(`/${encodeURIComponent(diagnosisId)}/feedback`, { helpful, wrong_cause: wrongCause });
  }
}

export function createSource(): DiagnosticsSource {
  const url = import.meta.env.VITE_DIAGNOSTICS_API_URL as string | undefined;
  return url ? new LiveSource(url) : new SampleSource();
}

export const SAMPLE_LINKS: { label: string; reference: string }[] = [
  { label: "Out of credits", reference: "https://aistudio.galleri5.com/model-garden?inference-id=665f1e2a9b3c4d5e6f708192&unit-session-id=665f1e1f9b3c4d5e6f708100" },
  { label: "Provider overloaded", reference: "https://aistudio.galleri5.com/generations/665f22b09b3c4d5e6f7081a4" },
  { label: "Timed out, but finished", reference: "https://aistudio.galleri5.com/model-garden?inference-id=665f30c49b3c4d5e6f7081f0" },
  { label: "Job system lost track", reference: "jr-0b7d55c1" },
  { label: "Unsupported file", reference: "https://aistudio.galleri5.com/generations/665f63bb9b3c4d5e6f708355" },
  { label: "Not enough evidence", reference: "665f52aa9b3c4d5e6f708301" },
  { label: "A whole session", reference: "https://aistudio.galleri5.com/model-garden/fal-ai/seedance-2-0-r2v?unit-session-id=665f1e1f9b3c4d5e6f708100" },
];
