import { useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  Copy,
  ExternalLink,
  HelpCircle,
  Info,
  LifeBuoy,
  Loader2,
  Minus,
  ThumbsDown,
  ThumbsUp,
  X,
  XCircle,
} from "lucide-react";
import type { Confidence, DiagnosisReport, StageState } from "../lib/types";
import { Button, Card, Pill, SectionLabel, buttonClass, cn, type PillColor } from "./ui";

const STUDIO = "https://aistudio.galleri5.com";

const CONFIDENCE: Record<Confidence, { label: string; color: PillColor; hint: string }> = {
  confirmed: { label: "Confirmed", color: "emerald", hint: "Stated directly by a structured signal" },
  probable: { label: "Probable", color: "amber", hint: "Strong pattern match, consistent with the timeline" },
  possible: { label: "Possible", color: "orange", hint: "Plausible, but the evidence is partial" },
  insufficient: { label: "Not enough evidence", color: "neutral", hint: "We won't guess" },
};

const STAGE: Record<StageState, { color: PillColor; icon: typeof Check; sr: string }> = {
  ok: { color: "emerald", icon: Check, sr: "done" },
  fail: { color: "red", icon: X, sr: "failed here" },
  skip: { color: "neutral", icon: Minus, sr: "not reached" },
  unknown: { color: "amber", icon: HelpCircle, sr: "unknown" },
  active: { color: "sky", icon: Loader2, sr: "in progress" },
};

function StatusIcon({ tone }: { tone: DiagnosisReport["tone"] }) {
  if (tone === "good") return <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />;
  if (tone === "neutral") return <Clock3 className="size-5 text-sky-600 dark:text-sky-400" />;
  if (tone === "warning") return <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />;
  return <XCircle className="size-5 text-red-600 dark:text-red-400" />;
}

function CopyId({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      title={`Copy ${label}`}
    >
      <span className="text-neutral-400">{label}</span> {value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value}
      {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3 opacity-60" />}
    </button>
  );
}

export function ReportView({
  report,
  onEscalate,
  onFeedback,
}: {
  report: DiagnosisReport;
  onEscalate: () => void;
  onFeedback: (helpful: boolean) => void;
}) {
  const [vote, setVote] = useState<null | boolean>(null);
  const conf = CONFIDENCE[report.confidence];
  const studioLink = `${STUDIO}/model-garden?inference-id=${report.subject.inference_id}${
    report.subject.unit_session_id ? `&unit-session-id=${report.subject.unit_session_id}` : ""
  }`;
  const recoveryColor: PillColor = report.recovery.tone === "good" ? "emerald" : report.recovery.tone === "warning" ? "amber" : "orange";

  return (
    <Card className="animate-fade-up overflow-hidden">
      <div className="flex flex-col gap-3 border-b bg-muted/40 px-5 py-4 sm:flex-row sm:items-start sm:justify-between dark:bg-white/[0.02]">
        <div className="min-w-0">
          <div className="flex items-start gap-2.5">
            <StatusIcon tone={report.tone} />
            <h2 className="text-base leading-6 font-semibold">{report.status_label}</h2>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-1 pl-7.5 text-xs text-muted-foreground">
            <span>{report.subject.model_label}</span>
            <span aria-hidden>·</span>
            <span>{report.subject.provider}</span>
            <span aria-hidden>·</span>
            <CopyId label="inference" value={report.subject.inference_id} />
            {report.subject.jobrouter_job_id && <CopyId label="job" value={report.subject.jobrouter_job_id} />}
          </div>
        </div>
        <div className="flex items-center gap-2 pl-7.5 sm:pl-0" title={conf.hint}>
          <span className="text-xs text-muted-foreground">Confidence</span>
          <Pill color={conf.color}>{conf.label}</Pill>
        </div>
      </div>

      <div className="grid gap-6 px-5 py-5">
        {report.platform_notice && (
          <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800 ring-1 ring-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-500/20">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span className="font-medium">{report.platform_notice}</span>
          </div>
        )}

        <section className="grid gap-2">
          <SectionLabel>What happened</SectionLabel>
          <p className="text-[0.95rem] leading-relaxed">{report.summary}</p>
        </section>

        <section className="grid gap-2.5">
          <SectionLabel>Where it stopped</SectionLabel>
          <ol className="flex flex-wrap items-center gap-1.5">
            {report.stages.map((stage, i) => {
              const s = STAGE[stage.state];
              const Icon = s.icon;
              return (
                <li key={stage.name} className="flex items-center gap-1.5">
                  {i > 0 && <ChevronRight className="size-3.5 text-neutral-300 dark:text-neutral-600" aria-hidden />}
                  <Pill color={s.color} className="px-2.5 py-1">
                    <Icon className={cn(stage.state === "active" && "animate-spin")} />
                    {stage.name}
                    <span className="sr-only"> ({s.sr})</span>
                  </Pill>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="grid gap-2">
          <SectionLabel>Why</SectionLabel>
          <p className="text-[0.95rem] leading-relaxed">{report.cause}</p>
        </section>

        <section className="grid gap-2.5">
          <SectionLabel>Evidence</SectionLabel>
          <ul className="grid gap-1.5">
            {report.evidence.map((ev) => (
              <li
                key={ev.id}
                className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-0.5 rounded-lg bg-muted/60 px-3 py-2.5 text-sm sm:grid-cols-[88px_1fr_auto] dark:bg-white/[0.03]"
              >
                <time className="col-span-2 font-mono text-xs text-muted-foreground sm:col-span-1">{ev.time ?? "n/a"}</time>
                <span className="min-w-0 break-words">
                  <span className="mr-1.5 text-xs text-muted-foreground">{ev.source}</span>
                  {ev.text}
                </span>
                <span className="rounded bg-neutral-200/70 px-1.5 py-0.5 font-mono text-[10.5px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                  {ev.id}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-2.5">
          <SectionLabel>What you can do</SectionLabel>
          <ol className="grid gap-2">
            {report.steps.map((step, i) => (
              <li key={step} className="flex gap-3 text-[0.95rem]">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-neutral-900 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900">
                  {i + 1}
                </span>
                <span className="pt-0.5 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="grid content-start gap-2">
            <SectionLabel>Can you fix this yourself?</SectionLabel>
            <div>
              <Pill color={recoveryColor} className="px-2.5 py-1 text-[13px]">
                {report.recovery.label}
              </Pill>
            </div>
          </section>
          <section className="grid content-start gap-2">
            <SectionLabel>Credits</SectionLabel>
            <p className="text-sm text-muted-foreground">{report.credits_note}</p>
          </section>
        </div>

        {report.missing_information.length > 0 && (
          <section className="flex items-start gap-2.5 rounded-lg border border-dashed px-3.5 py-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            <div>
              <span className="font-medium text-foreground">Not available yet: </span>
              {report.missing_information.join(" · ")}. Confidence would rise with this data.
            </div>
          </section>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t bg-muted/40 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:bg-white/[0.02]">
        <div className="flex flex-wrap gap-2">
          {(report.actions.includes("open_with_inputs") || report.actions.includes("open_generation")) && (
            <a className={buttonClass("default", "sm")} href={studioLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              {report.actions.includes("open_with_inputs") ? "Open with these inputs" : "Open generation"}
            </a>
          )}
          {report.actions.includes("escalate") && (
            <Button variant={report.actions.includes("open_with_inputs") ? "outline" : "default"} size="sm" onClick={onEscalate}>
              <LifeBuoy />
              Send to tech team
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-muted-foreground">
          <span className="mr-1 inline-flex items-center gap-1">
            <CircleDashed className="size-3" />
            {report.explained_by === "ai" ? "Explained by AI, checked against evidence" : "Explained by rules"} ·{" "}
            <span className="font-mono">{report.diagnostic_code}</span>
          </span>
          <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
          <span>Helpful?</span>
          {[true, false].map((up) => (
            <button
              key={String(up)}
              type="button"
              aria-pressed={vote === up}
              aria-label={up ? "Helpful" : "Not helpful"}
              onClick={() => {
                setVote(up);
                onFeedback(up);
              }}
              className={cn(
                "rounded-md p-1.5 hover:bg-accent hover:text-foreground",
                vote === up && "bg-accent text-foreground",
              )}
            >
              {up ? <ThumbsUp className="size-3.5" /> : <ThumbsDown className="size-3.5" />}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
