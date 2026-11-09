import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, History, Search, ShieldCheck, Sparkles } from "lucide-react";
import { EscalateDialog } from "../components/EscalateDialog";
import { Progress, PROGRESS_STEPS } from "../components/Progress";
import { ReportView } from "../components/ReportView";
import { SessionPicker } from "../components/SessionPicker";
import { useToast } from "../components/Toasts";
import { Button, Card, Input, Pill, SectionLabel, cn } from "../components/ui";
import { loadRecent, pushRecent, type RecentItem } from "../lib/recent";
import { parseReference, ReferenceError } from "../lib/resolver";
import { createSource, SAMPLE_LINKS } from "../lib/source";
import type { AnalyzeResponse, DiagnosisReport, SessionCandidate } from "../lib/types";

type View =
  | { kind: "idle" }
  | { kind: "running"; done: number }
  | { kind: "session"; title: string; candidates: SessionCandidate[] }
  | { kind: "report"; report: DiagnosisReport }
  | { kind: "error"; message: string };

const TONE_PILL = { good: "emerald", neutral: "sky", warning: "amber", critical: "red" } as const;

export function DebuggingPage() {
  const source = useMemo(createSource, []);
  const toast = useToast();
  const [value, setValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "idle" });
  const [recent, setRecent] = useState<RecentItem[]>(loadRecent);
  const [escalating, setEscalating] = useState<DiagnosisReport | null>(null);
  const runId = useRef(0);

  const analyze = useCallback(
    async (reference: string) => {
      try {
        parseReference(reference); // instant, friendly validation before any request
      } catch (err) {
        setInputError(err instanceof Error ? err.message : "That link couldn't be read.");
        return;
      }
      setInputError(null);
      const id = ++runId.current;
      setView({ kind: "running", done: 0 });

      let done = 0;
      const ticker = setInterval(() => {
        done = Math.min(done + 1, PROGRESS_STEPS.length - 1);
        if (runId.current === id) setView((v) => (v.kind === "running" ? { kind: "running", done } : v));
      }, 220);

      try {
        const [res] = await Promise.all([source.analyze(reference), new Promise((r) => setTimeout(r, 900))]);
        if (runId.current !== id) return;
        show(res as AnalyzeResponse);
      } catch (err) {
        if (runId.current !== id) return;
        if (err instanceof ReferenceError) {
          setInputError(err.message);
          setView({ kind: "idle" });
        } else {
          setView({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong." });
        }
      } finally {
        clearInterval(ticker);
      }
    },
    [source],
  );

  function show(res: AnalyzeResponse) {
    if (res.kind === "session") {
      setView({ kind: "session", title: res.session.title, candidates: res.candidates });
      return;
    }
    setView({ kind: "report", report: res.report });
    setRecent(pushRecent(res.report));
  }

  // Deep link: /?inference-id=… or /?ref=… (what a "Diagnose this generation" button would open)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const ref = q.get("ref") ?? q.get("inference-id") ?? q.get("job");
    if (ref) {
      setValue(ref);
      void analyze(ref);
    }
  }, [analyze]);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:py-8">
      <div className="grid min-w-0 content-start gap-6">
        <header className="grid gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Debugging</h1>
            <Pill color={source.mode === "live" ? "emerald" : "amber"}>{source.mode === "live" ? "Live data" : "Sample data"}</Pill>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Paste a generation link or ID to see what happened, why, and what to do next. Nothing here spends credits or changes your generations.
          </p>
        </header>

        <Card className="p-4 sm:p-5">
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void analyze(value);
            }}
          >
            <label htmlFor="ref" className="text-sm font-medium">
              Generation link or ID
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="ref"
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setInputError(null);
                  }}
                  placeholder="https://aistudio.galleri5.com/model-garden?inference-id=…"
                  className="pl-9 font-mono text-[13px] md:text-[13px]"
                  aria-invalid={!!inputError}
                  aria-describedby="ref-help"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <Button type="submit" size="lg" className="sm:w-auto" disabled={view.kind === "running"}>
                Analyze
                <ArrowRight />
              </Button>
            </div>
            <p id="ref-help" className={cn("text-xs", inputError ? "text-destructive" : "text-muted-foreground")}>
              {inputError ?? "Share links, session links, /generations links, inference IDs and jr- job IDs all work."}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="mr-1 text-xs text-muted-foreground">Try a sample:</span>
              {SAMPLE_LINKS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    setValue(s.reference);
                    void analyze(s.reference);
                  }}
                  className="cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </form>
        </Card>

        {view.kind === "running" && (
          <Card className="p-5">
            <Progress done={view.done} />
          </Card>
        )}
        {view.kind === "session" && <SessionPicker title={view.title} candidates={view.candidates} onPick={(id) => void analyze(id)} />}
        {view.kind === "report" && (
          <ReportView
            report={view.report}
            onEscalate={() => setEscalating(view.report)}
            onFeedback={(helpful) => {
              void source.feedback(view.report.id, helpful, !helpful).catch(() => {});
              toast(helpful ? "Thanks. Glad it helped." : "Thanks. Engineers review answers marked unhelpful.");
            }}
          />
        )}
        {view.kind === "error" && (
          <Card className="border-destructive/30 p-5 text-sm">
            <p className="font-medium text-destructive">{view.message}</p>
            <p className="mt-1 text-muted-foreground">Check the link, or try again in a moment.</p>
          </Card>
        )}
        {view.kind === "idle" && (
          <Card className="grid place-items-center gap-2 border-dashed px-6 py-12 text-center shadow-none">
            <Sparkles className="size-8 text-amber-500" />
            <p className="text-lg font-medium">Diagnose a generation</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Instead of posting the link in a group and waiting, paste it here. If a person is still needed, you can send it to the tech team with the
              diagnosis attached.
            </p>
          </Card>
        )}
      </div>

      <aside className="grid content-start gap-4">
        <Card className="p-4">
          <SectionLabel className="mb-3 flex items-center gap-1.5">
            <History className="size-3.5" /> Recent
          </SectionLabel>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Your recent diagnoses will show here.</p>
          ) : (
            <ul className="grid gap-1">
              {recent.map((r) => (
                <li key={r.inference_id}>
                  <button
                    type="button"
                    onClick={() => {
                      setValue(r.inference_id);
                      void analyze(r.inference_id);
                    }}
                    className="grid w-full cursor-pointer gap-1 rounded-md p-2 text-left hover:bg-accent"
                  >
                    <span className="truncate text-sm font-medium">{r.status_label}</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Pill color={TONE_PILL[r.tone]} className="px-1.5 py-0 text-[10px]">
                        {r.tone === "good" ? "OK" : r.tone === "neutral" ? "Info" : "Failed"}
                      </Pill>
                      <span className="truncate">{r.model_label}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-4">
          <SectionLabel className="mb-3">How it works</SectionLabel>
          <ol className="grid gap-2.5 text-sm">
            {[
              ["Reads the record", "Status, error and job history for the generation."],
              ["Matches known causes", "Shared rules for credits, inputs, providers and the job system."],
              ["Explains it plainly", "With evidence, confidence and next steps."],
              ["Escalates if needed", "A ticket that already has the diagnosis."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-2.5">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-amber-500 text-[11px] font-semibold text-neutral-950">{i + 1}</span>
                <span>
                  <span className="font-medium">{t}</span>
                  <span className="block text-muted-foreground">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
        <div className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800 ring-1 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-500/20">
          <ShieldCheck className="mt-px size-3.5 shrink-0" />
          Read-only. Links are checked, never opened by the server, and secrets are removed from errors.
        </div>
      </aside>

      {escalating && (
        <EscalateDialog
          report={escalating}
          onClose={() => setEscalating(null)}
          onSubmit={async (comment) => (await source.escalate(escalating.id, comment)).ticket_id}
        />
      )}
    </div>
  );
}
