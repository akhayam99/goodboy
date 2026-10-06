import './WorkflowRunMock.css';
import { MockStage } from './MockStage';
import { Waypoints } from './icons';
import { RunTree, StartsInChip, type RailGroupInput, type RunTreeRowData } from './kit';

type Props = {
  readonly className?: string;
};

const ROWS: readonly RunTreeRowData[] = [
  {
    id: 'step-5',
    stepLabel: '5',
    kind: 'tester',
    title: 'Replay one event three times',
    phase: 'queued',
    routing: { provider: 'anthropic', name: 'Haiku 4.5', isPlanned: true },
  },
  {
    id: 'step-4-2',
    stepLabel: '4.2',
    kind: 'debugger',
    title: 'Pick the retry limit',
    phase: 'waiting',
    reason: { kind: 'question', stepLabel: '4.2' },
    isNested: true,
    groupId: 'fan-4',
    routing: { provider: 'anthropic', name: 'Sonnet 5.5', detail: 'Medium' },
    time: '6m',
    cost: '$0.04',
  },
  {
    id: 'step-4-1',
    stepLabel: '4.1',
    kind: 'reviewer',
    title: 'Check the attempt counter against the spec',
    phase: 'failed',
    reason: { kind: 'stepFailed', stepLabel: '4.1' },
    isNested: true,
    groupId: 'fan-4',
    routing: { provider: 'codex', name: 'GPT-5.6 Terra' },
    time: '2m',
    cost: '$0.03',
  },
  {
    id: 'step-4',
    stepLabel: '4',
    kind: 'implementer',
    title: 'Record the attempts on each delivery in notify-relay',
    phase: 'running',
    routing: { provider: 'moonshot', name: 'Kimi K3', detail: 'Low' },
    time: '46m',
  },
  {
    id: 'step-3-1',
    stepLabel: '3.1',
    kind: 'docs',
    title: 'Note the retry limit in the runbook',
    phase: 'skipped',
    reason: { kind: 'skipped' },
    isNested: true,
    groupId: 'fan-3',
    routing: { provider: 'anthropic', name: 'Haiku 4.5' },
  },
  {
    id: 'step-3',
    stepLabel: '3',
    kind: 'implementer',
    title: 'Dedupe on the event id in payments-api',
    phase: 'done',
    isSelected: true,
    routing: { provider: 'codex', name: 'GPT-5.6 Sol', detail: 'Medium' },
    cost: '$0.94',
  },
  {
    id: 'step-2',
    stepLabel: '2',
    kind: 'planner',
    title: 'Agree where the dedupe belongs',
    phase: 'done',
    routing: { provider: 'anthropic', name: 'Opus 5.5', detail: 'High' },
    cost: '$1.28',
  },
  {
    id: 'step-1',
    stepLabel: '1',
    kind: 'scout',
    title: 'Trace where a retried webhook posts',
    phase: 'done',
    routing: { provider: 'cursor', name: 'Composer 2.5' },
    cost: '$0.13',
  },
];

const GROUPS: readonly RailGroupInput[] = [
  {
    id: 'fan-4',
    parentGroupId: null,
    identityIndex: 0,
    isMuted: false,
    originRowId: 'step-4',
    shape: 'merged',
  },
  {
    id: 'fan-3',
    parentGroupId: null,
    identityIndex: 1,
    isMuted: false,
    originRowId: 'step-3',
    shape: 'merged',
  },
];

export const WorkflowRunMock = ({ className }: Props) => (
  <MockStage
    label="Run of Duplicate credit fix, five steps. Step 5 is queued. Step 4 runs, with 4.1 failed and 4.2 waiting on your answer. Step 3.1 is skipped. Steps 1 to 3 are done."
    className={className}
  >
    <div className="wfrWin">
      <div className="wfrHead">
        <span className="wfrTile" aria-hidden>
          <Waypoints size={18} />
        </span>
        <div className="wfrHeadText">
          <h4 className="wfrTitle">Duplicate credit fix</h4>
          <p className="wfrMeta">5 steps, 10 agents, $2.74</p>
        </div>
      </div>
      <div className="wfrChips">
        <StartsInChip target="payments-api / hl/fix-duplicate-credit" />
      </div>
      <div className="wfrRows">
        <RunTree
          rows={ROWS}
          groups={GROUPS}
          hasSpine
          heading="Now"
          label="Run steps, newest first"
        />
      </div>
    </div>
  </MockStage>
);
