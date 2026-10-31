import type { ReactNode } from 'react';
import type { PlanChange } from '@goodboy/types';
import { TruncatedText, cn } from '@goodboy/ui';
import { PRESET_CHANGE_COPY } from '../../../../store/slices/workflows/presetChangeCopy';
import { agentKindPalette } from '../../../session/agent-kind';
import type { TimelineAgentEntry } from '../../../session/timeline/buildTimelineGroups';
import type { RowPhase } from '../../../workTreeModel/rowState';

const LIVE_PHASES: ReadonlySet<RowPhase> = new Set(['running', 'waiting', 'failed']);

type TitleParams = {
  readonly phase: RowPhase;
  readonly isNested: boolean;
};

const titleClassOf = ({ phase, isNested }: TitleParams): string => {
  if (!LIVE_PHASES.has(phase)) {
    return 'text-ui';
  }
  return isNested ? 'text-ui text-foreground' : 'text-row-strong text-foreground';
};

type Props = {
  readonly entry: TimelineAgentEntry;
  readonly glyph: ReactNode;
  readonly duration: ReactNode;
  readonly phase: RowPhase;
  readonly isNested: boolean;
  readonly change?: PlanChange | null;
};

export const RunTreeChecklistCells = ({
  entry,
  glyph,
  duration,
  phase,
  isNested,
  change = null,
}: Props) => {
  const step =
    entry.stepLabel == null ? '' : isNested ? entry.stepLabel : `Step ${entry.stepLabel}`;
  return (
    <>
      <span
        data-checklist-cell="step"
        className="w-14 shrink-0 truncate text-meta tabular-nums text-muted-foreground"
      >
        {step}
      </span>
      <span data-checklist-cell="role" className="flex w-28 shrink-0 items-center gap-1 text-meta">
        {glyph}
        <span className="min-w-0 truncate text-muted-foreground">
          {agentKindPalette({ kind: entry.agentKind }).label}
        </span>
      </span>
      <TruncatedText className={cn('min-w-0 flex-1 truncate', titleClassOf({ phase, isNested }))}>
        {entry.agent.name}
      </TruncatedText>
      {change === null ? null : (
        <span data-plan-change={change.kind} className="shrink-0 text-meta text-info">
          {PRESET_CHANGE_COPY.tag[change.kind]}
        </span>
      )}
      <span data-checklist-cell="duration" className="flex shrink-0 justify-end">
        {duration}
      </span>
    </>
  );
};
