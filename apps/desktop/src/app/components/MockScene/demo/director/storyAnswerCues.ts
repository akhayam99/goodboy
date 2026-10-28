import { brandId, type AgentId, type ProviderRunId, type SessionId } from '@goodboy/types';
import { STORY_PLANNER } from '../../scenes/story/storyContent';
import { storyPlanEnvelopeOf } from '../../scenes/story/storyPlan';
import type { DemoCue } from './directorTypes';
import { limitsHandoffCues } from './limitsHandoffCues';
import { registerStoryPlan } from './registerStoryPlan';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly text: string;
};

export const storyAnswerCues = ({ sessionId, agentId, text }: Params): ReadonlyArray<DemoCue> => {
  const codexRun = brandId<ProviderRunId>({ value: `demo-story-codex-${crypto.randomUUID()}` });
  return limitsHandoffCues({
    sessionId,
    agentId,
    text,
    reply: STORY_PLANNER.handoff,
    command: STORY_PLANNER.command,
    output: STORY_PLANNER.output,
    artifact: storyPlanEnvelopeOf({ revision: 1 }),
    claudeRun: brandId<ProviderRunId>({ value: `demo-story-claude-${crypto.randomUUID()}` }),
    codexRun,
    onDone: ({ store, at, hint }) => registerStoryPlan({ store, at, hint, runId: codexRun }),
  });
};
