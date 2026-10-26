import { brandId, type AgentId, type ProviderRunId, type SessionId } from '@goodboy/types';
import { fallbackNoticeMessage } from '../../../../../store/slices/turn/fallbackNoticeMessage';
import { BRAND_MODELS } from '../../scenes/brand/canon';
import type { DemoCue } from './directorTypes';
import { appendTurnEvents } from './appendTurnEvents';
import { eventCue } from './eventCue';
import { finishAgentTurn } from './finishAgentTurn';
import { startAgentTurn } from './startAgentTurn';
import { textCues } from './textCues';
import { textCuesEndMs } from './textCuesEndMs';

const SUITE_COMMAND = 'pnpm --filter payments-api test webhooks';
const CODEX = BRAND_MODELS.implement;
const CLAUDE = BRAND_MODELS.scout;

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly text: string;
  readonly reply: string;
};

type RunParams = {
  readonly label: string;
};

const runOf = ({ label }: RunParams): ProviderRunId =>
  brandId<ProviderRunId>({ value: `demo-limits-${label}-${crypto.randomUUID()}` });

export const limitsHandoffCues = ({
  sessionId,
  agentId,
  text,
  reply,
}: Params): ReadonlyArray<DemoCue> => {
  const claudeRun = runOf({ label: 'claude' });
  const codexRun = runOf({ label: 'codex' });
  const toolUseId = `demo-limits-suite-${codexRun}`;
  const replyAt = 4600;
  const doneAt = textCuesEndMs({ atMs: replyAt, text: reply }) + 500;
  return [
    {
      atMs: 0,
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
      atMs: 1500,
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
      atMs: 2400,
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
      atMs: 3900,
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
