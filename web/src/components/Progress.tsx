import { Check, Loader2 } from "lucide-react";
import { cn } from "./ui";

export const PROGRESS_STEPS = [
  "Checking the link",
  "Checking your access",
  "Finding the generation",
  "Reading job history",
  "Matching known causes",
  "Writing the explanation",
];

export function Progress({ done }: { done: number }) {
  return (
    <ul className="grid gap-2 py-1" aria-live="polite">
      {PROGRESS_STEPS.map((label, i) => {
        if (i > done) return null;
        const finished = i < done;
        return (
          <li key={label} className={cn("animate-fade-up flex items-center gap-2.5 text-sm", finished ? "text-foreground" : "text-muted-foreground")}>
            {finished ? <Check className="size-4 text-emerald-600 dark:text-emerald-400" /> : <Loader2 className="size-4 animate-spin text-amber-500" />}
            {label}
          </li>
        );
      })}
    </ul>
  );
}
