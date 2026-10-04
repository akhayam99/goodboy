import './SessionMock.css';
import { MockStage } from './MockStage';
import { MessageCircle, SquareKanban, Waypoints } from './icons';
import {
  AppTopBar,
  NeedsYouChip,
  RunTree,
  StartsInChip,
  type RailGroupInput,
  type RunTreeRowData,
  useIsCoarse,
} from './kit';

const HEADING = 'Now';

const ROWS: ReadonlyArray<RunTreeRowData> = [
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
    groupId: 'fan-4',
    isNested: true,
    gap: 'sibling',
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
    groupId: 'fan-4',
    isNested: true,
    gap: 'sibling',
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
    gap: 'sibling',
    routing: { provider: 'moonshot', name: 'Kimi K3', detail: 'Low' },
    time: '46m',
    cost: '$0.23',
  },
  {
    id: 'step-3',
    stepLabel: '3',
    kind: 'implementer',
    title: 'Dedupe on the event id in payments-api',
    phase: 'done',
    gap: 'sibling',
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
    gap: 'sibling',
    routing: { provider: 'anthropic', name: 'Opus 5.5', detail: 'High' },
    cost: '$1.28',
  },
  {
    id: 'step-1-3',
    stepLabel: '1.3',
    kind: 'scout',
    title: 'Check the retry notices in notify-relay',
    phase: 'done',
    groupId: 'fan-1',
    isNested: true,
    gap: 'sibling',
    routing: { provider: 'cursor', name: 'Composer 2.5' },
    cost: '$0.01',
  },
  {
    id: 'step-1-2',
    stepLabel: '1.2',
    kind: 'scout',
    title: 'Read the webhook handler in payments-api',
    phase: 'done',
    groupId: 'fan-1',
    isNested: true,
    gap: 'sibling',
    routing: { provider: 'codex', name: 'GPT-5.6 Terra' },
    cost: '$0.06',
  },
  {
    id: 'step-1-1',
    stepLabel: '1.1',
    kind: 'scout',
    title: 'Read the posting path in ledger-core',
    phase: 'done',
    groupId: 'fan-1',
    isNested: true,
    gap: 'sibling',
    routing: { provider: 'anthropic', name: 'Haiku 4.5' },
    cost: '$0.02',
  },
  {
    id: 'step-1',
    stepLabel: '1',
    kind: 'scout',
    title: 'Trace where a retried webhook posts',
    phase: 'done',
    gap: 'sibling',
    routing: { provider: 'cursor', name: 'Composer 2.5' },
    cost: '$0.13',
  },
];

const PHONE_ROW_IDS: ReadonlySet<string> = new Set([
  'step-5',
  'step-4-2',
  'step-4-1',
  'step-4',
  'step-3',
]);

const PHONE_ROWS: ReadonlyArray<RunTreeRowData> = ROWS.filter((row) => PHONE_ROW_IDS.has(row.id));

const GROUPS: ReadonlyArray<RailGroupInput> = [
  {
    id: 'fan-4',
    parentGroupId: null,
    identityIndex: 1,
    isMuted: false,
    originRowId: 'step-4',
    shape: 'merged',
  },
  {
    id: 'fan-1',
    parentGroupId: null,
    identityIndex: 2,
    isMuted: false,
    originRowId: 'step-1',
    shape: 'merged',
  },
];

export const SessionMock = () => {
  const isCoarse = useIsCoarse();
  return (
    <MockStage
      className="sessionMock"
      label="A workflow named Duplicate credit fix with five steps. Steps one to three are done, step four is running, one of its subagents failed and another waits on your answer, and step five is queued."
      isHero
    >
      <div className="smApp">
        <AppTopBar
          workspace="Harborline"
          search="Search or ask"
          nav={
            <>
              <span className="gkTopNavItem smNavItem">
                <SquareKanban size={14} />
                Board
              </span>
              <span className="gkTopNavItem smNavItem">
                <MessageCircle size={14} />
                Chat
              </span>
            </>
          }
          end={
            <>
              <NeedsYouChip count={1} className="smNeeds" />
              <span className="smRunning gkTopRunning">
                <span className="smRunningDot" aria-hidden="true" />1 running
              </span>
              <span className="gkTopToday smToday">
                <strong>$2.74</strong>
                today
              </span>
            </>
          }
        />
        <div className="smBody">
          <div className="smHead">
            <span className="smIcon" aria-hidden="true">
              <Waypoints size={20} />
            </span>
            <div className="smHeadText">
              <h3 className="smTitle">Duplicate credit fix</h3>
              <p className="smMeta">
                <span>5 steps</span>
                <span>10 agents</span>
                <span>$2.74</span>
                <span>Spend cap $12.00</span>
              </p>
            </div>
          </div>
          <div className="smStarts">
            <StartsInChip target="payments-api / hl/fix-duplicate-credit" />
          </div>
          <RunTree
            className="smTree"
            rows={isCoarse ? PHONE_ROWS : ROWS}
            groups={GROUPS}
            hasSpine
            heading={HEADING}
            label="Steps"
          />
        </div>
      </div>
    </MockStage>
  );
};
