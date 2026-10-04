import { useEffect, useState } from 'react';
import type {
  Agent,
  AgentHandoff,
  AgentId,
  ContextSlot,
  PlanId,
  PlanWithCount,
  ProviderRunId,
  SessionDecision,
  TurnEvent,
  WorkflowRunId,
} from '@goodboy/types';
import { ChatView } from '../../../../../features/chat/components/ChatView';
import { useAppStore } from '../../../../../store';
import { ShellFrame } from '../shellChrome';
import { useSceneClicks } from '../audit/useSceneClicks';
import { BRAND_DECISIONS, BRAND_MODELS, BRAND_SESSION } from './canon';
import {
  CTX_PAYMENTS_WORKTREE,
  CTX_SESSION,
  CTX_SESSION_ID,
  minutesAgo,
  seedContextBase,
} from './contextBase';

const RUN_ID = 'mock-brand-ctx-workflow-run' as WorkflowRunId;
const SCOUT_ID = 'mock-brand-ctx-agent-scout' as AgentId;
const PLAN_ID = 'mock-brand-ctx-agent-plan' as AgentId;
const IMPLEMENT_ID = 'mock-brand-ctx-agent-implement' as AgentId;
const IMPLEMENT_RUN = 'mock-brand-ctx-run-implement' as ProviderRunId;
const PLAN_DOC_ID = 'mock-brand-ctx-plan-dedupe' as PlanId;

const AGENTS: ReadonlyArray<Agent> = [
  {
    id: SCOUT_ID,
    sessionId: CTX_SESSION_ID,
    workflowRunId: RUN_ID,
    ordinal: 1,
    name: 'Scout',
    kind: 'scout',
    status: 'completed',
    startedAt: minutesAgo(113),
    lastFinishedAt: minutesAgo(111),
    lastViewedAt: minutesAgo(111),
    providerOverride: 'anthropic',
    modelOverride: BRAND_MODELS.scout.model,
  },
  {
    id: PLAN_ID,
    sessionId: CTX_SESSION_ID,
    workflowRunId: RUN_ID,
    ordinal: 2,
    name: 'Plan',
    kind: 'planner',
    status: 'completed',
    startedAt: minutesAgo(110),
    lastFinishedAt: minutesAgo(99),
    lastViewedAt: minutesAgo(98),
    providerOverride: 'anthropic',
    modelOverride: BRAND_MODELS.plan.model,
    effort: 'high',
  },
  {
    id: IMPLEMENT_ID,
    sessionId: CTX_SESSION_ID,
    workflowRunId: RUN_ID,
    ordinal: 3,
    name: 'Implement 3.1',
    kind: 'implementer',
    status: 'completed',
    runId: IMPLEMENT_RUN,
    startedAt: minutesAgo(96),
    lastFinishedAt: minutesAgo(41),
    lastViewedAt: minutesAgo(40),
    providerOverride: 'codex',
    modelOverride: BRAND_MODELS.implement.model,
  },
];

const decision = (
  entry: (typeof BRAND_DECISIONS)[number],
  createdMinutes: number,
  updatedMinutes: number,
): SessionDecision => ({
  id: `mock-brand-ctx-decision-${entry.number}`,
  sessionId: CTX_SESSION_ID,
  number: entry.number,
  text: entry.text,
  why: null,
  status: entry.state === 'replaced' ? 'replaced' : 'active',
  replacedBy: entry.state === 'replaced' ? 3 : null,
  author: 'agent',
  agentId: PLAN_ID,
  turnOrdinal: entry.turn,
  reason:
    entry.state === 'replaced'
      ? 'A retry that lands mid-transaction slips past a check in the handler.'
      : null,
  closedBy: entry.state === 'replaced' ? 'agent' : null,
  closedByAgentId: entry.state === 'replaced' ? PLAN_ID : null,
  previousText: null,
  rewordedAt: null,
  createdAt: minutesAgo(createdMinutes),
  updatedAt: minutesAgo(updatedMinutes),
});

const [D1, D2, D3] = BRAND_DECISIONS;

const DECISIONS: ReadonlyArray<SessionDecision> = [
  decision(D1, 107, 101),
  decision(D2, 106, 106),
  decision(D3, 101, 101),
];

const SLOTS: ReadonlyArray<ContextSlot> = [
  { key: 'goal', value: BRAND_SESSION.goal, enabled: true },
  {
    key: 'decisions',
    value: [`2. ${D2.text}`, `3. ${D3.text} (replaces 1)`].join('\n'),
    enabled: true,
  },
  {
    key: 'last_output_summary',
    value:
      'applyWebhook now inserts the processor event id inside the credit transaction and answers 200 on a duplicate. ledger-core rejects a second posting for the same event id.',
    enabled: true,
  },
];

const PLAN: PlanWithCount = {
  id: PLAN_DOC_ID,
  sessionId: CTX_SESSION_ID,
  agentId: PLAN_ID,
  title: 'Dedupe on the event id inside the transaction',
  bodyMd: '# Dedupe on the event id inside the transaction',
  status: 'active',
  createdAt: minutesAgo(100),
  updatedAt: minutesAgo(100),
  consumptionCount: 1,
};

const ASK = 'Make a redelivered webhook credit the account once, keyed on the processor event id.';

const SENT_MESSAGE = [
  '[projects-scope]',
  'Writes payments-api on hl/fix-duplicate-credit.',
  'Reads ledger-core. Never writes it from this step.',
  '[/projects-scope]',
  '',
  '[workspace-profile]',
  'Harborline. TypeScript services, pnpm, vitest. Money moves in integer cents.',
  '[/workspace-profile]',
  '',
  '[role]',
  'You are the implementation agent for step 3 of 5. Change only what the ask needs, run the tests you touch, and finish with a short summary of what changed.',
  '[/role]',
  '',
  '**Goal** Stop retried webhooks posting a second credit (HBL-412).',
  '',
  '**Ask** Make a redelivered webhook credit the account once, keyed on the processor event id.',
  '',
  '**Decisions**',
  '2. Keep the processor event id on every credit row',
  '3. Dedupe on the event id inside the transaction (replaces 1)',
  '',
  '**Earlier steps**',
  'Scout: applyWebhook posts the credit before it records the event, so a retry inside the 30 s window posts twice.',
  'Plan: insert the event id in the same transaction as the credit, unique on (account_id, event_id).',
  '',
  '**Files** src/webhooks/applyWebhook.ts, src/ledger/postCredit.ts, test/applyWebhook.test.ts',
  '',
  '**Done when** the same event delivered three times leaves one credit row and three 200 responses.',
].join('\n');

const HANDOFF: AgentHandoff = {
  agentId: IMPLEMENT_ID,
  sender: { kind: 'workflowStep', workflowRunId: RUN_ID, stepOrdinal: 3, stepCount: 5 },
  ask: ASK,
  why: 'D3 moved the dedupe inside the transaction, so the handler check from D1 is gone.',
  doneWhen: 'The same event delivered three times leaves one credit row and three 200 responses.',
  sections: [
    { kind: 'ask', summary: ASK, bodyMd: ASK, refs: [] },
    {
      kind: 'earlierSteps',
      summary: '2 steps passed their result to this one',
      bodyMd: '',
      refs: [
        {
          kind: 'agent',
          agentId: SCOUT_ID,
          ordinal: 1,
          label: 'Scout',
          detail: 'The credit posts before the event is recorded.',
        },
        {
          kind: 'agent',
          agentId: PLAN_ID,
          ordinal: 2,
          label: 'Plan',
          detail: 'Insert the event id in the credit transaction.',
        },
      ],
    },
    {
      kind: 'plan',
      summary: PLAN.title,
      bodyMd: '',
      refs: [{ kind: 'plan', planId: PLAN_DOC_ID, label: PLAN.title }],
    },
    {
      kind: 'files',
      summary: '3 files',
      bodyMd: '',
      refs: [
        { kind: 'file', label: 'applyWebhook.ts', path: 'src/webhooks/applyWebhook.ts' },
        { kind: 'file', label: 'postCredit.ts', path: 'src/ledger/postCredit.ts' },
        { kind: 'file', label: 'applyWebhook.test.ts', path: 'test/applyWebhook.test.ts' },
      ],
    },
    {
      kind: 'role',
      summary: 'Implementer · built in',
      bodyMd:
        'You are the implementation agent for step 3 of 5. Change only what the ask needs, run the tests you touch, and finish with a short summary of what changed.',
      refs: [],
    },
  ],
  sentSystem: null,
  sentMessage: SENT_MESSAGE,
  provider: 'codex',
  createdAt: minutesAgo(96),
};

const path = (relative: string): string => `${CTX_PAYMENTS_WORKTREE}/${relative}`;

const TRANSCRIPT: ReadonlyArray<TurnEvent> = [
  {
    kind: 'user_text',
    runId: IMPLEMENT_RUN,
    text: SENT_MESSAGE,
    handoffId: IMPLEMENT_ID,
    provider: 'codex',
    model: BRAND_MODELS.implement.model,
    at: minutesAgo(96),
  },
  {
    kind: 'assistant_text',
    runId: IMPLEMENT_RUN,
    delta:
      'Moving the event id insert into the credit transaction. A unique violation on `(account_id, event_id)` now means the event already landed, so the handler answers 200 and posts nothing.',
    at: minutesAgo(95),
  },
  {
    kind: 'file_edit',
    runId: IMPLEMENT_RUN,
    path: path('src/webhooks/applyWebhook.ts'),
    editType: 'modify',
    at: minutesAgo(94),
  },
  {
    kind: 'file_edit',
    runId: IMPLEMENT_RUN,
    path: path('src/ledger/postCredit.ts'),
    editType: 'modify',
    at: minutesAgo(79),
  },
  {
    kind: 'file_edit',
    runId: IMPLEMENT_RUN,
    path: path('test/applyWebhook.test.ts'),
    editType: 'modify',
    at: minutesAgo(61),
  },
  {
    kind: 'assistant_text',
    runId: IMPLEMENT_RUN,
    delta:
      'Done. The redelivery test sends evt_4Q2x three times: one credit row, three 200 responses. 38 tests pass.',
    at: minutesAgo(41),
  },
  { kind: 'done', runId: IMPLEMENT_RUN, at: minutesAgo(41) },
];

const CLICKS: ReadonlyArray<string> = [
  'Replaced and withdrawn',
  'sent by',
  'All',
  'View as sent to Codex',
];

export const BrandContextScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedContextBase({ lens: 'agents' });
    useAppStore.setState({
      selectedAgentId: { [CTX_SESSION_ID]: IMPLEMENT_ID },
      sessionPhaseRuns: { [CTX_SESSION_ID]: AGENTS },
      transcripts: { [IMPLEMENT_ID]: TRANSCRIPT },
      agentHandoffs: { [IMPLEMENT_ID]: HANDOFF },
      loadAgentHandoff: async () => undefined,
      sessionEvents: { [CTX_SESSION_ID]: [] },
      sessionOpenQuestions: { [CTX_SESSION_ID]: [] },
      sessionAnsweredQuestions: { [CTX_SESSION_ID]: [] },
      sessionDismissedQuestions: { [CTX_SESSION_ID]: [] },
      sessionPlans: { [CTX_SESSION_ID]: [PLAN] },
      sessionExternalTasks: {
        [CTX_SESSION_ID]: [
          {
            sessionId: CTX_SESSION_ID,
            provider: 'linear',
            externalId: 'mock-brand-ctx-hbl-412',
            identifier: BRAND_SESSION.issue,
            url: `https://example.invalid/linear/${BRAND_SESSION.issue}`,
            title: BRAND_SESSION.issueTitle,
            createdAt: minutesAgo(116),
          },
        ],
      },
      sessionSlots: { [CTX_SESSION_ID]: SLOTS },
      sessionSlotsLoad: { [CTX_SESSION_ID]: 'loaded' },
      sessionDecisions: { [CTX_SESSION_ID]: DECISIONS },
      sessionDecisionsBaseline: { [CTX_SESSION_ID]: minutesAgo(1) },
      sessionContextSeenAt: { [CTX_SESSION_ID]: minutesAgo(1) },
      slotHistory: { [CTX_SESSION_ID]: {} },
      slotHistoryCounts: { [CTX_SESSION_ID]: { decisions: 3 } },
      summarizerStatus: {
        [CTX_SESSION_ID]: {
          status: 'idle',
          lastUpdate: minutesAgo(40),
          error: null,
          lastUsage: null,
          lastAttempt: null,
        },
      },
      ensureSessionSlots: async () => undefined,
      loadSessionSlots: async () => undefined,
      loadSessionDecisions: async () => undefined,
      loadSessionContextSeen: async () => undefined,
      markSessionContextSeen: async () => undefined,
      loadSessionEvents: async () => undefined,
      loadSessionOpenQuestions: async () => undefined,
      loadSessionAnsweredQuestions: async () => undefined,
      loadSessionDismissedQuestions: async () => undefined,
      loadAgentTranscript: async () => undefined,
      markAgentViewed: async () => undefined,
      refreshProviders: async () => undefined,
      ensureProjectMounted: async () => undefined,
      recordSessionEvent: async () => undefined,
    } as never);
    useAppStore.getState().openContextDrawer({ sessionId: CTX_SESSION_ID, tab: 'decisions' });
    setIsReady(true);
  }, []);

  useSceneClicks({
    isReady,
    labels: CLICKS,
    selector: 'button',
    match: 'prefix',
    intervalMs: 300,
  });

  if (!isReady) {
    return null;
  }

  return <ShellFrame session={CTX_SESSION} main={<ChatView session={CTX_SESSION} />} />;
};
