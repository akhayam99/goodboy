import { brandId, type AgentId, type ProviderRunId, type SessionId } from '@goodboy/types';
import type { AppStore } from '../../../../../store/store';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import { fallbackNoticeMessage } from '../../../../../store/slices/turn/fallbackNoticeMessage';
import { BRAND_MODELS } from '../../scenes/brand/canon';
import type { DemoCue, DemoTimeline, TimelineParams } from './directorTypes';
import { appendTurnEvents } from './appendTurnEvents';
import { eventCue } from './eventCue';
import { finishAgentTurn } from './finishAgentTurn';
import { installDemoWorld } from './installDemoWorld';
import { scheduleCues } from './scheduleCues';
import { startAgentTurn } from './startAgentTurn';
import { textCues } from './textCues';
import { textCuesEndMs } from './textCuesEndMs';

const BRIEF = 'Rebased on main. Run the redelivery and postings suites again.';
const BRIEF_REPLY =
  'Picked up the same brief on Codex. Both suites still pass after the rebase, and the redelivery test still posts one credit for evt_7Qm2.';
const SAMPLE_REPLY =
  'Picked that up on Codex with the same brief Claude had. Running the redelivery and postings suites again, then I will report back.';
const SUITE_COMMAND = 'pnpm --filter payments-api test webhooks';
const CODEX = BRAND_MODELS.implement;
const CLAUDE = BRAND_MODELS.scout;

type HandoffParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly text: string;
  readonly reply: string;
  readonly atMs: number;
};

type RunParams = {
  readonly label: string;
};

const runOf = ({ label }: RunParams): ProviderRunId =>
  brandId<ProviderRunId>({ value: `demo-limits-${label}-${crypto.randomUUID()}` });

const handoffCues = ({
  sessionId,
  agentId,
  text,
  reply,
  atMs,
}: HandoffParams): ReadonlyArray<DemoCue> => {
  const claudeRun = runOf({ label: 'claude' });
  const codexRun = runOf({ label: 'codex' });
  const toolUseId = `demo-limits-suite-${codexRun}`;
  const replyAt = atMs + 4600;
  const doneAt = textCuesEndMs({ atMs: replyAt, text: reply }) + 500;
  return [
    {
      atMs,
      apply: ({ store, at }) => {
        appendTurnEvents({
          store,
          agentId,
          events: [
            {
              kind: 'user_text',
              runId: claudeRun,
              text,
              provider: CLAUDE.provider,
              model: CLAUDE.model,
              at,
            },
          ],
        });
        startAgentTurn({ store, sessionId, agentId, runId: claudeRun, at });
      },
    },
    {
      atMs: atMs + 1500,
      apply: ({ store, at }) => {
        appendTurnEvents({
          store,
          agentId,
          events: [
            {
              kind: 'decision_note',
              runId: claudeRun,
              message: fallbackNoticeMessage({
                provider: CLAUDE.provider,
                failure: 'usage_limit',
                plan: { provider: CODEX.provider, model: CODEX.model },
              }),
              at,
            },
          ],
        });
        startAgentTurn({ store, sessionId, agentId, runId: codexRun, at });
      },
    },
    eventCue({
      atMs: atMs + 2400,
      agentId,
      events: ({ at }) => [
        {
          kind: 'tool_call_start',
          runId: codexRun,
          toolUseId,
          toolName: 'Bash',
          input: { command: SUITE_COMMAND },
          at,
        },
      ],
    }),
    eventCue({
      atMs: atMs + 3900,
      agentId,
      events: ({ at }) => [
        {
          kind: 'tool_call_end',
          runId: codexRun,
          toolUseId,
          output: 'Test Files  4 passed (4)\n     Tests  31 passed (31)',
          isError: false,
          at,
        },
      ],
    }),
    ...textCues({ atMs: replyAt, agentId, runId: codexRun, text: reply }),
    {
      atMs: doneAt,
      apply: ({ store, at }) => {
        appendTurnEvents({ store, agentId, events: [{ kind: 'done', runId: codexRun, at }] });
        finishAgentTurn({ store, sessionId, agentId, at, isViewed: true });
      },
    },
  ];
};

type TargetParams = TimelineParams;

type Target = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const targetOf = ({ state }: TargetParams): Target | null => {
  const sessionId = state.currentSessionId;
  if (sessionId === null) {
    return null;
  }
  const agentId = state.selectedAgentId[sessionId] ?? null;
  return agentId === null ? null : { sessionId, agentId };
};

export const limitsTimeline = ({ state }: TimelineParams): DemoTimeline | null => {
  const target = targetOf({ state });
  if (target === null) {
    return null;
  }
  return {
    setup: ({ store }) => {
      installDemoWorld({ store });
      const sendTurn = (async (input) => {
        const agentId = input.agentId ?? target.agentId;
        store.setState((current) => ({
          agentDraft: Object.fromEntries(
            Object.entries(current.agentDraft).filter(([id]) => id !== agentId),
          ),
        }));
        input.onStarted?.();
        scheduleCues({
          store,
          cues: handoffCues({
            sessionId: input.sessionId,
            agentId,
            text: input.content,
            reply: SAMPLE_REPLY,
            atMs: 0,
          }),
          now: () => nowIso({}),
          agentId,
        });
        return { blockedOverBudget: false };
      }) satisfies AppStore['sendTurn'];
      store.setState({ sendTurn });
    },
    prepare: () => undefined,
    cues: handoffCues({ ...target, text: BRIEF, reply: BRIEF_REPLY, atMs: 1200 }),
  };
};
