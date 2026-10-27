import type { AgentId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../../../../store/store';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import type { DemoTimeline, TimelineParams } from './directorTypes';
import { installDemoWorld } from './installDemoWorld';
import { limitsHandoffCues } from './limitsHandoffCues';
import { scheduleCues } from './scheduleCues';

const ANSWER_REPLY =
  'Thanks, that settles it: one posting per event id. Updating ledger-core to match, then rerunning the redelivery test.';
const HANDOFF_REPLY =
  'Picked that up on Codex with the same brief Claude had. Running the redelivery and postings suites again, then I will report back.';

type Target = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const targetOf = ({ state }: TimelineParams): Target | null => {
  const sessionId = state.currentSessionId;
  if (sessionId === null) {
    return null;
  }
  const agentId = state.selectedAgentId[sessionId];
  const hasQuestion = (state.sessionOpenQuestions[sessionId] ?? []).some(
    (entry) => entry.isBlocking && entry.status === 'open',
  );
  if (agentId === null || agentId === undefined || !hasQuestion) {
    return null;
  }
  return { sessionId, agentId };
};

export const agentTimeline = ({ state }: TimelineParams): DemoTimeline | null => {
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
          cues: limitsHandoffCues({
            sessionId: input.sessionId,
            agentId,
            text: input.content,
            reply: HANDOFF_REPLY,
          }),
          now: () => nowIso({}),
          agentId,
        });
        return { blockedOverBudget: false };
      }) satisfies AppStore['sendTurn'];
      store.setState({ sendTurn });
    },
    answerReply: ANSWER_REPLY,
    prepare: () => undefined,
    cues: [],
  };
};
