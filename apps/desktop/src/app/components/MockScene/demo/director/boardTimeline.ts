import type { OpenQuestion, OpenQuestionId } from '@goodboy/types';
import { landingLiveKey } from '../../../../../features/chat/reveal/landingLiveKey';
import { liveTextRegistry } from '../../../../../features/chat/reveal/liveTextRegistry';
import type { DemoTimeline, TimelineParams } from './directorTypes';
import { travelCard } from './travelCard';

const MOVE_MS = 2600;

export const boardTimeline = ({ state }: TimelineParams): DemoTimeline | null => {
  const session = state.sessions.find(
    (entry) =>
      entry.state.kind === 'running' &&
      (state.sessionPhaseRuns[entry.id] ?? []).some((agent) => agent.status === 'running'),
  );
  if (session === undefined) {
    return null;
  }
  const sessionId = session.id;
  const agent = (state.sessionPhaseRuns[sessionId] ?? []).find(
    (entry) => entry.status === 'running',
  );
  if (agent === undefined) {
    return null;
  }
  return {
    prepare: () => undefined,
    cues: [
      {
        atMs: MOVE_MS,
        apply: ({ store, at }) => {
          const question: OpenQuestion = {
            id: `demo-board-question-${sessionId}` as OpenQuestionId,
            sessionId,
            createdByAgentId: agent.id,
            turnOrdinal: 1,
            text: 'Two rows still disagree with the snapshot. Hold the Monday close, or post the rest and flag those two?',
            suggestedAnswers: ['Hold the close', 'Post the rest and flag them'],
            recommendedAnswer: 'Post the rest and flag them',
            selectMode: 'one',
            isBlocking: true,
            userAnswer: null,
            status: 'open',
            createdAt: at,
          };
          liveTextRegistry.mark({ runId: landingLiveKey({ scope: 'questions', id: sessionId }) });
          const move = () =>
            store.setState((current) => ({
              sessions: current.sessions.map((entry) =>
                entry.id === sessionId
                  ? { ...entry, state: { kind: 'idle', lastActivityAt: at }, updatedAt: at }
                  : entry,
              ),
              sessionPhaseRuns: {
                ...current.sessionPhaseRuns,
                [sessionId]: (current.sessionPhaseRuns[sessionId] ?? []).map((entry) =>
                  entry.id === agent.id
                    ? { ...entry, status: 'completed', completedAt: at, lastFinishedAt: at }
                    : entry,
                ),
              },
              agentTurnState: {
                ...current.agentTurnState,
                [agent.id]: { kind: 'idle', lastActivityAt: at },
              },
              sessionOpenQuestions: {
                ...current.sessionOpenQuestions,
                [sessionId]: [...(current.sessionOpenQuestions[sessionId] ?? []), question],
              },
            }));
          travelCard({ selector: `article[data-select-id="${sessionId}"]`, apply: move });
        },
      },
    ],
  };
};
