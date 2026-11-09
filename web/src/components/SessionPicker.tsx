import { ChevronRight, Layers } from "lucide-react";
import type { SessionCandidate } from "../lib/types";
import { clock } from "../lib/engine";
import { Card, Pill, statusColor } from "./ui";

export function SessionPicker({
  title,
  candidates,
  onPick,
}: {
  title: string;
  candidates: SessionCandidate[];
  onPick: (inferenceId: string) => void;
}) {
  return (
    <Card className="animate-fade-up overflow-hidden">
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <span className="grid size-9 place-items-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <Layers className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">This link is a session with {candidates.length} generations</h2>
          <p className="text-sm text-muted-foreground">{title}. Pick the one to diagnose. Failed ones are listed first.</p>
        </div>
      </div>
      <ul className="divide-y">
        {candidates.map((c) => (
          <li key={c.inference_id}>
            <button
              type="button"
              onClick={() => onPick(c.inference_id)}
              className="flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-accent/60"
            >
              <Pill color={statusColor(c.status)} className="w-[86px] justify-center capitalize">
                {c.status}
              </Pill>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.model_label}</span>
                <span className="block font-mono text-xs text-muted-foreground">
                  {c.inference_id.slice(0, 8)}… · {clock(c.created_at) ?? "n/a"} UTC
                </span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
