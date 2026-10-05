import { useContext } from 'react';
import { formatUsd } from '@goodboy/ui';
import { WorkTimeContext } from '../../../../../workTreeModel/workTimeSource';
import type { AgentStatus } from '@goodboy/types';
import type {
  TimelineAgentEntry,
  TimelineRunEntry,
} from '../../../../timeline/buildTimelineGroups';
import { runRanModels } from '../../../../timeline/ranModels';
import { runStepProgress } from '../../../../timeline/runStepProgress';
import { runWorkflowKind } from '../../../../timeline/runWorkflowKind';
import { RowCardHeader } from './RowCardHeader';
import { TimelineProviderGlyph } from './TimelineProviderGlyph';
import { TimelineRunChip } from './TimelineRunChip';
import { RUN_KIND_GLYPH } from './runKindGlyph';

type Props = {
  readonly entry: TimelineRunEntry;
  readonly isModelsOnly?: boolean;
};

const STATUS_WORD: Record<AgentStatus, string> = {
  completed: 'done',
  running: 'running',
  pending: 'queued',
  failed: 'failed',
  blocked: 'blocked',
  stopped: 'stopped',
  skipped: 'skipped',
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

const tallyOf = ({ entry }: { readonly entry: TimelineRunEntry }): string => {
  const steps = entry.children.flatMap((child) => (child.kind === 'agent' ? [child] : []));
  const parts = STATUS_ORDER.flatMap((status) => {
    const count = steps.filter((step) => step.agent.status === status).length;
    return count === 0 ? [] : [`${count} ${STATUS_WORD[status]}`];
  });
  const answered = answersOf({ entries: steps });
  if (answered > 0) {
    parts.push(`${answered} ${answered === 1 ? 'question' : 'questions'} answered`);
  }
  return parts.join(' · ');
};

const NO_SPANS: ReadonlyArray<never> = [];

export const RunIdentityCard = ({ entry, isModelsOnly = false }: Props) => {
  const source = useContext(WorkTimeContext);
  const kind = runWorkflowKind({ workflow: entry.workflow });
  const models = runRanModels({ spans: source?.spans ?? NO_SPANS, runId: entry.run.id });
  const tally = tallyOf({ entry });
  const progress = runStepProgress({ entry });
  return (
    <span className="flex flex-col gap-2">
      <RowCardHeader
        glyph={<TimelineRunChip kind={kind} workflowName={entry.workflow.name} />}
        title={entry.run.title ?? entry.workflow.name}
        sub={RUN_KIND_GLYPH[kind].label}
      />
      {isModelsOnly || tally === '' ? null : (
        <span className="text-body text-foreground">{tally}</span>
      )}
      {isModelsOnly || progress === null ? null : (
        <span className="text-meta text-muted-foreground">{progress}</span>
      )}
      {models.length === 0 ? null : (
        <>
          <span className="text-eyebrow text-faint-foreground">Models</span>
          <ul className="flex flex-col gap-1 text-meta">
            {models.map((model) => (
              <li key={model.key} className="flex items-center gap-2">
                <TimelineProviderGlyph provider={model.provider} />
                <span className="min-w-0 flex-1 truncate text-foreground">{model.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {model.stepCount === 1 ? '1 step' : `${model.stepCount} steps`}
                </span>
                <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">
                  {model.costUsd > 0 ? formatUsd(model.costUsd) : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </span>
  );
};
