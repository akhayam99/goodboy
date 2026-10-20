import { useContext } from 'react';
import { FactCard, formatUsd, type Fact } from '@goodboy/ui';
import { WorkTimeContext } from '../../../../../workTreeModel/workTimeSource';
import type { AgentStatus } from '@goodboy/types';
import type {
  TimelineAgentEntry,
  TimelineRunEntry,
} from '../../../../timeline/buildTimelineGroups';
import { runRanModels } from '../../../../timeline/ranModels';
import { runStepProgress } from '../../../../timeline/runStepProgress';
import { runWorkflowKind } from '../../../../timeline/runWorkflowKind';
import { TimelineRunGlyph } from './TimelineRunGlyph';
import { RUN_KIND_GLYPH } from './runKindGlyph';
import { fitCardRows } from '../../../../../../shared/utils/fitCardRows';
import type { CardTrigger } from './timelineRowIdentity';

type Props = {
  readonly entry: TimelineRunEntry;
  readonly isModelsOnly?: boolean;
  readonly isOpen?: boolean;
  readonly children: CardTrigger;
};

const STATUS_WORD: Record<AgentStatus, string> = {
  completed: 'Done',
  running: 'Running',
  pending: 'Queued',
  failed: 'Failed',
  blocked: 'Blocked',
  stopped: 'Stopped',
  skipped: 'Skipped',
};

const STATUS_ORDER: ReadonlyArray<AgentStatus> = [
  'completed',
  'running',
  'pending',
  'failed',
  'blocked',
  'stopped',
  'skipped',
];

const answersOf = ({ entries }: { readonly entries: ReadonlyArray<TimelineAgentEntry> }): number =>
  entries.reduce(
    (total, step) => total + step.answers.length + answersOf({ entries: step.children }),
    0,
  );

const tallyOf = ({ entry }: { readonly entry: TimelineRunEntry }): ReadonlyArray<Fact> => {
  const steps = entry.children.flatMap((child) => (child.kind === 'agent' ? [child] : []));
  const rows: Array<Fact> = STATUS_ORDER.flatMap((status) => {
    const count = steps.filter((step) => step.agent.status === status).length;
    return count === 0 ? [] : [{ label: STATUS_WORD[status], value: String(count) }];
  });
  const answered = answersOf({ entries: steps });
  if (answered > 0) {
    rows.push({ label: 'Answered', value: String(answered) });
  }
  return rows;
};

const NO_SPANS: ReadonlyArray<never> = [];

export const RunIdentityCard = ({
  entry,
  isModelsOnly = false,
  isOpen = false,
  children,
}: Props) => {
  const source = useContext(WorkTimeContext);
  const kind = runWorkflowKind({ workflow: entry.workflow });
  const models = runRanModels({ spans: source?.spans ?? NO_SPANS, runId: entry.run.id });
  const progress = runStepProgress({ entry });
  const rows: Array<Fact> = [];
  if (!isModelsOnly) {
    if (progress !== null) {
      rows.push({ label: 'Progress', value: progress });
    }
    rows.push(...tallyOf({ entry }));
  }
  for (const model of models) {
    rows.push({
      label: model.name,
      value: model.stepCount === 1 ? '1 step' : `${model.stepCount} steps`,
      ...(model.costUsd > 0 ? { note: formatUsd(model.costUsd) } : {}),
    });
  }
  const fitted = fitCardRows({ facts: rows });
  return (
    <FactCard
      isOpen={isOpen}
      card={{
        glyph: <TimelineRunGlyph kind={kind} />,
        title: entry.run.title ?? entry.workflow.name,
        sub: RUN_KIND_GLYPH[kind].label,
        facts: fitted.facts,
        ...(fitted.footnote === undefined ? {} : { footnote: fitted.footnote }),
      }}
    >
      {children}
    </FactCard>
  );
};
