import { FactCard } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { brandId } from '@goodboy/types';
import { railRowCardOf } from '../../../../../features/auto/chat/railRowCardOf';
import type { RailRow } from '../../../../../features/auto/chat/railRowsOf';
import { serviceUsageCardOf } from '../../../../../features/scripts/components/ScriptRow/serviceUsageCardOf';
import { clockSpanCardOf } from '../../../../../features/session/timeline/clockSpan';
import { workEstimateOf, workTime } from '../../../../../features/workTreeModel/workTime';
import { workTimeCardOf } from '../../../../../features/workTreeModel/workTimeCardOf';
import { chatSessionCardOf } from '../../../../../features/workspace-chat/components/ChatList/chatSessionCardOf';
import { routingLabelModel } from '../../../../../shared/components/RoutingLabel/routingLabelModel';

const ROW: RailRow = {
  id: 'implementer',
  agentId: brandId({ value: 'agent-implementer' }),
  kind: 'child',
  depth: 1,
  role: 'implementer',
  label: 'Implementer',
  task: 'Post one credit per retry in ledger-core',
  node: 'running',
  word: 'Running',
  tone: 'info',
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: 'high',
  isLive: true,
};

const ROUTING = routingLabelModel({
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: 'high',
  planned: { provider: 'anthropic', model: 'claude-opus-5', effort: 'high' },
  isEffortObserved: false,
}).card;

const CHAT_SESSIONS = chatSessionCardOf({
  marker: {
    count: 2,
    tone: 'info',
    isPulsing: false,
    entries: [
      {
        sessionId: brandId<SessionId>({ value: 'session-retry' }),
        title: 'Retry keys in payments-api',
        stage: 'building',
        stageLabel: 'Building',
      },
      {
        sessionId: brandId<SessionId>({ value: 'session-export' }),
        title: 'Northwind export header',
        stage: 'review',
        stageLabel: 'In review',
      },
    ],
  },
});

const SERVICE = serviceUsageCardOf({
  name: 'notify-relay',
  facts: { cpuPercent: 12.4, rssBytes: 52_428_800 },
  isRunning: true,
});

const SLOW_TIME = workTime({
  phase: 'running',
  activeMs: 14 * 60_000,
  hasStarted: true,
  estimate: workEstimateOf({
    estimate: {
      tier: 'role',
      size: null,
      sampleCount: 12,
      lowMs: 300_000,
      midMs: 420_000,
      highMs: 600_000,
      cost: null,
    },
    basis: 'Based on 12 similar steps.',
  }),
  unknownBasis: null,
});

const TRIGGER_CLASSES =
  'inline-flex h-7 items-center justify-center rounded-md border border-border-soft px-2 text-meta text-muted-foreground';

export const RailChatCardsStage = () => (
  <div
    data-testid="rail-chat-cards-stage"
    className="grid w-264 grid-cols-3 items-start gap-x-6 gap-y-44 rounded-lg border border-border-soft bg-subtle p-6 pb-44"
  >
    <FactCard isOpen card={railRowCardOf({ row: ROW })}>
      <span className={TRIGGER_CLASSES}>Implementer</span>
    </FactCard>
    {ROUTING === null ? null : (
      <FactCard isOpen card={ROUTING}>
        <span className={TRIGGER_CLASSES}>Sonnet 5</span>
      </FactCard>
    )}
    <FactCard isOpen card={CHAT_SESSIONS}>
      <span className={TRIGGER_CLASSES}>2 sessions</span>
    </FactCard>
    <FactCard
      isOpen
      card={{
        title: 'Answer',
        facts: [
          { label: 'Cost', value: '$0.04' },
          { label: 'Read', value: '2 files' },
        ],
      }}
    >
      <span className={TRIGGER_CLASSES}>Answered in 6s</span>
    </FactCard>
    {SERVICE === null ? null : (
      <FactCard isOpen card={SERVICE}>
        <span className={TRIGGER_CLASSES}>Running 4m</span>
      </FactCard>
    )}
    {SLOW_TIME === null ? null : (
      <FactCard
        isOpen
        card={workTimeCardOf({ time: SLOW_TIME, cost: '$0.42', note: SLOW_TIME.note })}
      >
        <span className={TRIGGER_CLASSES}>14m</span>
      </FactCard>
    )}
    <FactCard
      isOpen
      card={clockSpanCardOf({
        startedAt: '2026-10-19T09:00:00Z',
        finishedAt: '2026-10-19T09:04:00Z',
        phase: 'done',
      })}
    >
      <span className={TRIGGER_CLASSES}>09:00</span>
    </FactCard>
  </div>
);
