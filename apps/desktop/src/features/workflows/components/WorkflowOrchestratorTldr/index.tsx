import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Chip, Divider, Markdown, Tooltip, type Tone } from '@goodboy/ui';
import type { Step, WorkflowRun } from '@goodboy/types';

const COLLAPSED_COUNT = 3;

const OUTCOME_LABEL = {
  done: 'Run complete',
  blocked: 'Stopped, needs a human call',
} as const;

const OUTCOME_TONE = {
  done: 'success',
  blocked: 'warning',
} as const satisfies Record<'done' | 'blocked', Tone>;

const ROW_BUTTON =
  'flex min-w-0 items-baseline gap-2 rounded-md text-left text-2xs transition-colors hover:bg-muted/40';

type Props = {
  readonly steps: ReadonlyArray<Step>;
  readonly run?: WorkflowRun;
};

export const WorkflowOrchestratorTldr = ({ steps, run }: Props) => {
  const [listOpen, setListOpen] = useState(false);
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
  const summary =
    entries.length === 0
      ? 'Why the run ended'
      : entries.length === 1
        ? '1 decision'
        : `${entries.length} decisions`;

  return (
    <>
      <Divider />
      <section
        data-testid="workflow-orchestrator-tldr"
        aria-label="Orchestrator reasoning"
        className="flex min-w-0 flex-col gap-1.5"
      >
        <button
          type="button"
          aria-expanded={listOpen}
          data-testid="workflow-orchestrator-decisions-toggle"
          onClick={() => setListOpen((open) => !open)}
          className="flex items-center gap-1 self-start rounded-md text-2xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {listOpen ? (
            <ChevronDown size={11} aria-hidden className="shrink-0" />
          ) : (
            <ChevronRight size={11} aria-hidden className="shrink-0" />
          )}
          {summary}
        </button>
        {listOpen ? (
          <>
            {hidden > 0 || showAll ? (
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                className="self-start text-2xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {showAll ? 'Show less' : `Show ${hidden} earlier`}
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
              <div
                data-testid="workflow-orchestrator-closing"
                className="flex min-w-0 flex-col gap-1"
              >
                <Tooltip content={`Why the run ended: ${OUTCOME_LABEL[outcome]}`}>
                  <button
                    type="button"
                    aria-expanded={closingOpen}
                    aria-label={`Why the run ended: ${OUTCOME_LABEL[outcome]}`}
                    onClick={() => setClosingOpen((open) => !open)}
                    className={ROW_BUTTON}
                  >
                    <Chip
                      tone={OUTCOME_TONE[outcome]}
                      size="xs"
                      bordered={false}
                      label={OUTCOME_LABEL[outcome]}
                      className="shrink-0 font-semibold"
                    />
                    {!closingOpen && (
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {closingReason}
                      </span>
                    )}
                  </button>
                </Tooltip>
                {closingOpen ? (
                  <div className="min-w-0 pl-5">
                    <Markdown text={closingReason} className="text-2xs leading-relaxed" />
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </>
  );
};
