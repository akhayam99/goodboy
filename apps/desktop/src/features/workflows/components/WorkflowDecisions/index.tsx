import { useState } from 'react';
import { History } from 'lucide-react';
import { ClampedProse, CountToggle, SectionHeader, cn } from '@goodboy/ui';
import type { Step, WorkflowRun } from '@goodboy/types';
import type { RunTreeModel } from '../RunTree/useRunTree';
import { WorkflowDecisionNode } from './WorkflowDecisionNode';
import { decisionEntries } from './decisionEntries';

const COLLAPSED_COUNT = 5;

type Props = {
  readonly run: WorkflowRun;
  readonly steps: ReadonlyArray<Step>;
  readonly tree: RunTreeModel | null;
  readonly highlightedStepId: string | null;
  readonly onHighlight: (stepId: string | null) => void;
};

const escapeMarkdown = ({ text }: { readonly text: string }): string =>
  text.replace(/([\\`*_[\]#<>])/gu, '\\$1');

export const WorkflowDecisions = ({ run, steps, tree, highlightedStepId, onHighlight }: Props) => {
  const [isEarlierShown, setIsEarlierShown] = useState(false);
  const { closing, decisions } = decisionEntries({ run, steps, tree });
  if (closing === null && decisions.length === 0) {
    return null;
  }
  const shown = isEarlierShown ? decisions : decisions.slice(0, COLLAPSED_COUNT);
  const earlierCount = Math.max(0, decisions.length - COLLAPSED_COUNT);
  const count =
    decisions.length === 0
      ? null
      : `${decisions.length} ${decisions.length === 1 ? 'decision' : 'decisions'}`;

  return (
    <section
      aria-label="Why each step"
      data-testid="workflow-decisions"
      className="flex min-w-0 flex-col gap-2"
    >
      <SectionHeader
        label="Why each step"
        action={
          count === null ? undefined : (
            <span className="text-secondary tabular-nums text-faint-foreground">{count}</span>
          )
        }
      />
      <ol className="flex min-w-0 flex-col gap-0.5">
        {closing === null ? null : (
          <li
            data-testid="workflow-decision-closing"
            className="grid min-w-0 grid-cols-[20px_minmax(0,1fr)] items-start gap-2 rounded-md px-2 py-1.5"
          >
            <WorkflowDecisionNode item={null} outcome={closing.outcome} />
            <ClampedProse
              text={`**${closing.label}** ${closing.reason}`}
              lines={3}
              className="text-xs leading-relaxed text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground"
            />
          </li>
        )}
        {shown.map((decision) => {
          const isHighlighted = decision.stepId === highlightedStepId;
          return (
            <li
              key={decision.stepId}
              data-testid={`workflow-decision-${decision.stepId}`}
              data-highlighted={isHighlighted}
              onMouseEnter={() => onHighlight(decision.stepId)}
              onMouseLeave={() => onHighlight(null)}
              className={cn(
                'grid min-w-0 grid-cols-[20px_minmax(0,1fr)] items-start gap-2 rounded-md px-2 py-1.5 motion-safe:transition-colors',
                isHighlighted && 'bg-hover',
              )}
            >
              <WorkflowDecisionNode item={decision.item} outcome={null} />
              <ClampedProse
                text={`**${escapeMarkdown({ text: decision.title })}** ${decision.reason}`}
                lines={3}
                className="text-xs leading-relaxed text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground"
              />
            </li>
          );
        })}
      </ol>
      {earlierCount === 0 ? null : (
        <CountToggle
          label="earlier"
          count={earlierCount}
          icon={History}
          isShown={isEarlierShown}
          onChange={setIsEarlierShown}
        />
      )}
    </section>
  );
};
