import { type AgentId, type ProviderRunId, type SessionId } from '@goodboy/types';
import { fallbackNoticeMessage } from '../../../../../store/slices/turn/fallbackNoticeMessage';
import { BRAND_MODELS } from '../../scenes/brand/canon';
import type { DemoCue } from './directorTypes';
import { appendTurnEvents } from './appendTurnEvents';
import { eventCue } from './eventCue';
import { finishAgentTurn } from './finishAgentTurn';
import { patchAgent } from './patchAgent';
import { startAgentTurn } from './startAgentTurn';
import { textCues } from './textCues';
import { textCuesEndMs } from './textCuesEndMs';

const CODEX = BRAND_MODELS.implement;
const CLAUDE = BRAND_MODELS.scout;

const NOTICE_AT_MS = 1500;
const TOOL_START_AT_MS = 2400;
const TOOL_END_AT_MS = 3900;
const REPLY_AT_MS = 4600;

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly text: string;
  readonly reply: string;
  readonly command: string;
  readonly output: string;
  readonly artifact: string;
  readonly claudeRun: ProviderRunId;
  readonly codexRun: ProviderRunId;
  readonly onDone: DemoCue['apply'];
};

export const limitsHandoffCues = ({
  sessionId,
  agentId,
  text,
  reply,
  command,
  output,
  artifact,
  claudeRun,
  codexRun,
  onDone,
}: Params): ReadonlyArray<DemoCue> => {
  const toolUseId = `demo-limits-tool-${codexRun}`;
  const replyEndAt = textCuesEndMs({ atMs: REPLY_AT_MS, text: reply });
  const doneAt = replyEndAt + 700;
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
      atMs: NOTICE_AT_MS,
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
        patchAgent({
          store,
          sessionId,
          agentId,
          patch: { providerOverride: CODEX.provider, modelOverride: CODEX.model },
        });
        startAgentTurn({ store, sessionId, agentId, runId: codexRun, at });
      },
    },
    eventCue({
      atMs: TOOL_START_AT_MS,
      agentId,
      events: ({ at }) => [
        {
          kind: 'tool_call_start',
          runId: codexRun,
          toolUseId,
          toolName: 'Bash',
          input: { command },
          at,
        },
      ],
    }),
    eventCue({
      atMs: TOOL_END_AT_MS,
      agentId,
      events: ({ at }) => [
        { kind: 'tool_call_end', runId: codexRun, toolUseId, output, isError: false, at },
      ],
    }),
    ...textCues({ atMs: REPLY_AT_MS, agentId, runId: codexRun, text: reply }),
    eventCue({
      atMs: replyEndAt,
      agentId,
      events: ({ at }) => [
        { kind: 'assistant_text', runId: codexRun, delta: `\n\n${artifact}`, at },
      ],
    }),
    {
      atMs: doneAt,
      apply: ({ store, at, hint }) => {
        appendTurnEvents({ store, agentId, events: [{ kind: 'done', runId: codexRun, at }] });
        finishAgentTurn({ store, sessionId, agentId, at, isViewed: true });
        onDone({ store, at, hint });
      },
    },
  ];
};
