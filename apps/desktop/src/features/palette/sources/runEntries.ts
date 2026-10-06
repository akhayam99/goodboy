import type { WorkflowRunFacts } from '../../actions/kinds/workflowRun';
import type { WorkflowRunActionTarget } from '../../actions/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { orderRunVerbs } from '../paletteTiers';
import type { PaletteEntry } from '../types';

type RunState = WorkflowRunFacts['state'];

type PickParams = {
  readonly candidates: ReadonlyArray<WorkflowRunFacts>;
  readonly focusedRunId: string | null;
};

type RowParams = {
  readonly facts: WorkflowRunFacts;
  readonly open: () => void;
};

type SectionParams = {
  readonly row: PaletteEntry | null;
  readonly verbs: ReadonlyArray<PaletteEntry>;
  readonly startRun: PaletteEntry | null;
  readonly openRuns: PaletteEntry | null;
};

export type PaletteRun = {
  readonly target: WorkflowRunActionTarget;
  readonly facts: WorkflowRunFacts;
};

const STATE_LABEL: Readonly<Record<RunState, string>> = {
  queued: 'Queued',
  running: 'Running',
  paused: 'Paused',
  failed: 'Needs you',
  done: 'Done',
  discarded: 'Archived',
};

const STATE_RANK: Readonly<Record<RunState, number>> = {
  failed: 0,
  paused: 1,
  running: 2,
  queued: 3,
  done: 4,
  discarded: 5,
};

export const pickRun = ({ candidates, focusedRunId }: PickParams): WorkflowRunFacts | null => {
  const visible = candidates.filter((facts) => facts.state !== 'discarded');
  const focused = visible.find((facts) => facts.run.id === focusedRunId) ?? null;
  if (focused !== null) {
    return focused;
  }
  return (
    [...visible].sort((first, second) => STATE_RANK[first.state] - STATE_RANK[second.state])[0] ??
    null
  );
};

export const runRow = ({ facts, open }: RowParams): PaletteEntry => ({
  key: `run:${facts.run.id}`,
  label: facts.name,
  kind: 'run',
  group: null,
  icon: CONCEPT_ICONS.workflows,
  ...(facts.readyStepName === null ? {} : { detail: `Next: ${facts.readyStepName}` }),
  tag: STATE_LABEL[facts.state],
  run: open,
});

export const runSection = ({
  row,
  verbs,
  startRun,
  openRuns,
}: SectionParams): ReadonlyArray<PaletteEntry> => [
  ...(row === null ? [] : [row]),
  ...orderRunVerbs({ verbs }),
  ...(startRun === null ? [] : [startRun]),
  ...(openRuns === null ? [] : [openRuns]),
];
