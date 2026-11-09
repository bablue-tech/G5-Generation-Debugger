import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, Paperclip, X } from "lucide-react";
import type { DiagnosisReport } from "../lib/types";
import { Button, Textarea, buttonClass } from "./ui";

export function EscalateDialog({
  report,
  onClose,
  onSubmit,
}: {
  report: DiagnosisReport;
  onClose: () => void;
  onSubmit: (comment: string) => Promise<string>;
}) {
  const [comment, setComment] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "sending" } | { kind: "done"; ticket: string } | { kind: "error"; message: string }>({
    kind: "idle",
  });
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>("textarea, button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const attached = [
    ["Category", "Generation failed or stuck"],
    ["Diagnosis", `${report.status_label} (${report.diagnostic_code})`],
    ["Inference ID", report.subject.inference_id],
    ["Job ID", report.subject.jobrouter_job_id ?? "n/a"],
    ["Session ID", report.subject.unit_session_id ?? "n/a"],
    ["Evidence", `${report.evidence.length} items, secrets removed`],
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="escalate-title">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div ref={panel} className="animate-fade-up relative grid w-full max-w-lg gap-4 rounded-lg border bg-background p-6 shadow-lg">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 rounded-sm opacity-70 hover:opacity-100" aria-label="Close">
          <X className="size-4" />
        </button>

        {state.kind === "done" ? (
          <div className="grid justify-items-center gap-3 py-4 text-center">
            <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400" />
            <h2 id="escalate-title" className="text-lg font-semibold">Ticket {state.ticket} created</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              The tech team gets the diagnosis and evidence with it, so they won't need to start from scratch.
            </p>
            <div className="mt-2 flex gap-2">
              <a className={buttonClass("outline", "sm")} href="https://aistudio.galleri5.com/support/tickets" target="_blank" rel="noopener noreferrer">
                <ExternalLink /> View my tickets
              </a>
              <Button size="sm" onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-1.5 pr-6">
              <h2 id="escalate-title" className="text-lg leading-none font-semibold">Send to tech team</h2>
              <p className="text-sm text-muted-foreground">This raises a support ticket that already includes the diagnosis.</p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3 dark:bg-white/[0.02]">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Paperclip className="size-3.5" /> Attached automatically
              </div>
              <dl className="grid gap-1 text-sm">
                {attached.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[104px_1fr] gap-2">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="min-w-0 truncate font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <label className="grid gap-1.5 text-sm font-medium">
              <span>
                Anything else? <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <Textarea
                value={comment}
                maxLength={2000}
                onChange={(e) => setComment(e.target.value)}
                placeholder="For example: needed for tonight's review, or what you already tried"
              />
            </label>
            {state.kind === "error" && <p className="text-sm text-destructive">{state.message}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                disabled={state.kind === "sending"}
                onClick={async () => {
                  setState({ kind: "sending" });
                  try {
                    setState({ kind: "done", ticket: await onSubmit(comment.trim()) });
                  } catch (err) {
                    setState({ kind: "error", message: err instanceof Error ? err.message : "Couldn't create the ticket." });
                  }
                }}
              >
                {state.kind === "sending" && <Loader2 className="animate-spin" />}
                Send ticket
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
