import { useState } from 'react';
import { Waypoints } from 'lucide-react';
import type { Step } from '@goodboy/types';

const COLLAPSED_COUNT = 3;

type Props = {
  readonly steps: ReadonlyArray<Step>;
};

export const WorkflowOrchestratorTldr = ({ steps }: Props) => {
  const [showAll, setShowAll] = useState(false);
  const entries = [...steps]
    .sort((left, right) => left.ordinal - right.ordinal)
    .flatMap((step) => {
      const reason = step.orchestratorReason?.trim() ?? '';
      return reason === '' ? [] : [{ id: step.id, name: step.name, reason }];
    });
  if (entries.length === 0) {
    return null;
  }
  const visible = showAll ? entries : entries.slice(-COLLAPSED_COUNT);
  const hidden = entries.length - visible.length;

  return (
    <section
      data-testid="workflow-orchestrator-tldr"
      aria-label="Orchestrator reasoning"
      className="flex flex-col gap-1.5 rounded-lg border border-border-soft bg-subtle p-3"
    >
      <div className="flex items-center gap-1.5">
        <Waypoints size={11} aria-hidden className="shrink-0 text-accent" />
        <h3 className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          Why these steps
        </h3>
      </div>
      <ol className="flex flex-col gap-1">
        {visible.map((entry, index) => (
          <li key={entry.id} className="flex min-w-0 items-baseline gap-2 text-2xs">
            <span className="shrink-0 tabular-nums text-muted-foreground/60">
              {entries.length - visible.length + index + 1}
            </span>
            <span className="shrink-0 max-w-40 truncate font-medium text-foreground">
              {entry.name}
            </span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground" title={entry.reason}>
              {entry.reason}
            </span>
          </li>
        ))}
      </ol>
      {hidden > 0 || showAll ? (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="self-start text-2xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {showAll ? 'show less' : `show ${hidden} earlier`}
        </button>
      ) : null}
    </section>
  );
};
