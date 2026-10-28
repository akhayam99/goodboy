import type { AgentId, ProviderRunId, SessionId } from '@goodboy/types';
import { BRAND_MODELS } from '../../scenes/brand/canon';
import { STORY_PLANNER } from '../../scenes/story/storyContent';
import { storyPlanEnvelopeOf, storyPlanOf, storyPlanStoredOf } from '../../scenes/story/storyPlan';
import { STORY_SESSION_ID } from '../../scenes/story/storyWorld';
import { applyAutoScene } from './applyAutoScene';
import type { DemoCue } from './directorTypes';
import { appendTurnEvents } from './appendTurnEvents';
import { eventCue } from './eventCue';
import { finishAgentTurn } from './finishAgentTurn';
import { startAgentTurn } from './startAgentTurn';
import { textCues } from './textCues';
import { textCuesEndMs } from './textCuesEndMs';

const CODEX = BRAND_MODELS.implement;

const REPLY_AT_MS = 1200;
const DONE_GAP_MS = 700;

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly text: string;
  readonly runId: ProviderRunId;
  readonly onDone: DemoCue['apply'];
};

export const storyRevisionCues = ({
  sessionId,
  agentId,
  text,
  runId,
  onDone,
}: Params): ReadonlyArray<DemoCue> => {
  const replyEndAt = textCuesEndMs({ atMs: REPLY_AT_MS, text: STORY_PLANNER.revision });
  return [
    {
      atMs: 0,
      apply: ({ store, at }) => {
        appendTurnEvents({
          store,
          agentId,
          events: [
            { kind: 'user_text', runId, text, provider: CODEX.provider, model: CODEX.model, at },
          ],
        });
        startAgentTurn({ store, sessionId, agentId, runId, at });
      },
    },
    ...textCues({ atMs: REPLY_AT_MS, agentId, runId, text: STORY_PLANNER.revision }),
    eventCue({
      atMs: replyEndAt,
      agentId,
      events: ({ at }) => [
        {
          kind: 'assistant_text',
          runId,
          delta: `\n\n${storyPlanEnvelopeOf({ revision: 2 })}`,
          at,
        },
      ],
    }),
    {
      atMs: replyEndAt + DONE_GAP_MS,
      apply: ({ store, at, hint }) => {
        appendTurnEvents({ store, agentId, events: [{ kind: 'done', runId, at }] });
        store.setState((current) => ({
          sessionPlans: {
            ...current.sessionPlans,
            [STORY_SESSION_ID]: [storyPlanOf({ revision: 2, at })],
          },
          sessionArtifacts: {
            ...current.sessionArtifacts,
            [STORY_SESSION_ID]: [storyPlanStoredOf({ revision: 2, at, runId })],
          },
        }));
        finishAgentTurn({ store, sessionId, agentId, at, isViewed: true });
        applyAutoScene({ store, state: 'plan', at, implementerRunId: runId, revision: 2 });
        onDone({ store, at, hint });
      },
    },
  ];
};
