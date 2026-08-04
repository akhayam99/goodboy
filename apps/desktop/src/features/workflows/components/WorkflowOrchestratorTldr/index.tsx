import { useState } from 'react';
import { cn, Divider, Markdown } from '@goodboy/ui';
import type { Step, WorkflowRun } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

const COLLAPSED_COUNT = 3;

const OUTCOME_LABEL = {
  done: 'run complete',
  blocked: 'stopped, needs a human call',
} as const;

const OUTCOME_TONE = {
  done: 'bg-success/10 text-success',
  blocked: 'bg-warning/10 text-warning',
} as const;

const ROW_BUTTON =
  'flex min-w-0 items-baseline gap-2 rounded-md text-left text-2xs transition-colors hover:bg-muted/40';

type Props = {
  readonly steps: ReadonlyArray<Step>;
  readonly run?: WorkflowRun;
};

export const WorkflowOrchestratorTldr = ({ steps, run }: Props) => {
  const [showAll, setShowAll] = useState(false);
  const [openIds, setOpenIds] = useState<ReadonlyArray<string>>([]);
  const [closingOpen, setClosingOpen] = useState(false);
  const entries = [...steps]
    .sort((left, right) => left.ordinal - right.ordinal)
    .flatMap((step) => {
      const reason = step.orchestratorReason?.trim() ?? '';
      return reason === '' ? [] : [{ id: step.id, name: step.name, reason }];
    });
  const outcome = run?.orchestrationOutcome;
  const closingReason = run?.orchestrationReason?.trim() ?? '';
  const hasClosing = outcome != null && closingReason !== '';
  if (entries.length === 0 && !hasClosing) {
    return null;
  }
  const visible = showAll ? entries : entries.slice(-COLLAPSED_COUNT);
  const hidden = entries.length - visible.length;
  const toggleRow = (id: string) => {
    setOpenIds((ids) => (ids.includes(id) ? ids.filter((open) => open !== id) : [...ids, id]));
  };

  return (
    <section
      data-testid="workflow-orchestrator-tldr"
      aria-label="Orchestrator reasoning"
      className="flex flex-col gap-1.5 rounded-lg border border-border-soft bg-subtle p-3"
    >
      <div className="flex items-center gap-1.5">
        <CONCEPT_ICONS.workflows size={11} aria-hidden className="shrink-0 text-accent" />
        <h3 className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          Orchestrator decisions
        </h3>
      </div>
      {hidden > 0 || showAll ? (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="self-start text-2xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {showAll ? 'show less' : `show ${hidden} earlier`}
        </button>
      ) : null}
      <ol className="flex flex-col gap-1">
        {visible.map((entry, index) => {
          const isOpen = openIds.includes(entry.id);
          return (
            <li key={entry.id} className="flex min-w-0 flex-col gap-1">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-label={`Why ${entry.name}`}
                onClick={() => toggleRow(entry.id)}
                className={ROW_BUTTON}
              >
                <span className="shrink-0 tabular-nums text-muted-foreground/60">
                  {entries.length - visible.length + index + 1}
                </span>
                <span className="min-w-0 max-w-[50%] truncate font-medium text-foreground">
                  {entry.name}
                </span>
                {!isOpen && (
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {entry.reason}
                  </span>
                )}
              </button>
              {isOpen ? (
                <div className="min-w-0 pl-5">
                  <Markdown text={entry.reason} className="text-2xs leading-relaxed" />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      {hasClosing ? (
        <>
          <Divider />
          <div data-testid="workflow-orchestrator-closing" className="flex min-w-0 flex-col gap-1">
            <button
              type="button"
              aria-expanded={closingOpen}
              aria-label={`Why the run ended: ${OUTCOME_LABEL[outcome]}`}
              onClick={() => setClosingOpen((open) => !open)}
              className={ROW_BUTTON}
            >
              <span
                className={cn(
                  'shrink-0 rounded-full px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide',
                  OUTCOME_TONE[outcome],
                )}
              >
                {OUTCOME_LABEL[outcome]}
              </span>
              {!closingOpen && (
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {closingReason}
                </span>
              )}
            </button>
            {closingOpen ? (
              <div className="min-w-0 pl-5">
                <Markdown text={closingReason} className="text-2xs leading-relaxed" />
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
};
