import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type TurnEvent,
} from '@goodboy/types';
import type { ItemWorkState } from '../../../../../features/live-state/itemWork/itemWorkWords';
import { ITEM_WORK_WORDS } from '../../../../../features/live-state/itemWork/itemWorkWords';

export type ItemWorkSceneRow = Readonly<{
  id: string;
  title: string;
  state: ItemWorkState;
  detail: string | null;
  transcript: ReadonlyArray<TurnEvent> | null;
  agentId: AgentId | null;
  liveForMs: number | null;
  isAgentWaiting: boolean;
  hasVerbs: boolean;
  action: string | null;
}>;

const RUN_ID = brandId<ProviderRunId>({ value: 'run-u48-item-work' });
const AT = brandId<IsoDateTime>({ value: '2026-11-17T10:00:00.000Z' });

type ToolParams = {
  readonly name: string;
  readonly input: unknown;
};

const openTool = ({ name, input }: ToolParams): ReadonlyArray<TurnEvent> => [
  {
    kind: 'tool_call_start',
    runId: RUN_ID,
    toolUseId: `u48-${name}`,
    toolName: name,
    input,
    at: AT,
  },
];

type TextParams = {
  readonly delta: string;
};

const textLine = ({ delta }: TextParams): ReadonlyArray<TurnEvent> => [
  { kind: 'assistant_text', runId: RUN_ID, delta, at: AT },
];

type AgentParams = {
  readonly id: string;
};

const agentOf = ({ id }: AgentParams): AgentId => brandId<AgentId>({ value: `agent-u48-${id}` });

const BASE = {
  detail: null,
  transcript: null,
  agentId: null,
  liveForMs: null,
  isAgentWaiting: false,
  hasVerbs: false,
  action: null,
} as const satisfies Partial<ItemWorkSceneRow>;

const VERB = ITEM_WORK_WORDS.verb;

export const ITEM_WORK_SCENE_ROWS: ReadonlyArray<ItemWorkSceneRow> = [
  {
    ...BASE,
    id: 'starting',
    title: 'payments-api / test',
    state: 'starting',
    detail: 'The Debugger is getting a copy of the branch',
    action: 'Analyze',
  },
  {
    ...BASE,
    id: 'analyzing',
    title: 'payments-api / test',
    state: 'analyzing',
    transcript: openTool({ name: 'Read', input: { file_path: 'src/webhooks/retryPolicy.ts' } }),
    agentId: agentOf({ id: 'analyzing' }),
    liveForMs: 38_000,
    hasVerbs: true,
  },
  {
    ...BASE,
    id: 'fixing',
    title: 'src/webhooks/metrics.ts:18',
    state: 'fixing',
    transcript: openTool({ name: 'Bash', input: { command: 'pnpm test metrics' } }),
    agentId: agentOf({ id: 'fixing' }),
    liveForMs: 72_000,
    hasVerbs: true,
  },
  {
    ...BASE,
    id: 'waiting',
    title: 'src/webhooks/idempotency.ts:55',
    state: 'fixing',
    detail: 'Needs permission to run pnpm install',
    agentId: agentOf({ id: 'waiting' }),
    isAgentWaiting: true,
    hasVerbs: true,
  },
  {
    ...BASE,
    id: 'queued',
    title: 'src/webhooks/retryPolicy.ts:7',
    state: 'queued',
    detail: '2nd in this fix',
    hasVerbs: true,
  },
  {
    ...BASE,
    id: 'in-run',
    title: 'src/webhooks/config.ts:3',
    state: 'inRun',
    transcript: textLine({ delta: 'Planning the change.\n\n- Moving the constant into config.ts' }),
    action: VERB.openRun,
  },
  {
    ...BASE,
    id: 'cause-found',
    title: 'payments-api / test',
    state: 'causeFound',
    detail: 'The retry test expects 3 attempts; retryPolicy.ts now makes 5.',
    action: VERB.reviewFix,
  },
  {
    ...BASE,
    id: 'fix-ready',
    title: 'src/webhooks/metrics.ts:18',
    state: 'fixReady',
    detail: '+1 in metrics.ts',
    action: VERB.review,
  },
  {
    ...BASE,
    id: 'question',
    title: 'src/webhooks/idempotency.ts:55',
    state: 'question',
    detail: 'Keep the old insertCredit for the backfill job?',
    action: VERB.answer,
  },
  {
    ...BASE,
    id: 'fixed-not-pushed',
    title: 'ledger-core / lint',
    state: 'fixedNotPushed',
    detail: '4f21c8b on hl/fix-duplicate-credit. Push it so the check runs again.',
    action: VERB.push,
  },
  {
    ...BASE,
    id: 'pushed-checking',
    title: 'payments-api / test',
    state: 'pushedChecking',
    detail: 'The check runs again',
    agentId: agentOf({ id: 'pushed' }),
    liveForMs: 4_000,
  },
  {
    ...BASE,
    id: 'fixed',
    title: 'payments-api / test',
    state: 'fixed',
    detail: '4f21c8b pushed, the check passed in 1m 10s.',
    action: VERB.openChanges,
  },
  {
    ...BASE,
    id: 'no-fix',
    title: 'notify-relay / build',
    state: 'noFixFound',
    detail: 'The runner ran out of memory; the code looks fine.',
    action: VERB.analyzeAgain,
  },
  {
    ...BASE,
    id: 'stopped',
    title: 'ledger-core / lint',
    state: 'stopped',
    detail: 'You stopped it after 0:51. Nothing changed on the branch.',
    action: VERB.retry,
  },
  {
    ...BASE,
    id: 'failed',
    title: 'payments-api / test',
    state: 'failed',
    detail: 'The fix ended without a commit: the test file was moved.',
    action: VERB.retry,
  },
];
