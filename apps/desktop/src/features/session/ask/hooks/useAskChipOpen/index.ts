import { useCallback } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { openPlanDrawer } from '../../../../plans/openPlanDrawer';
import { useAppStore } from '../../../../../store';
import { agentHomeFor } from '../../../../../store/slices/navigation/agentHomeFor';
import { agentPlace, sessionPlace } from '../../../../../store/slices/navigation/place';
import { resolverThread } from '../../../../../store/slices/navigation/resolverThread';
import type { PlaceRequest } from '../../../../../store/slices/navigation/types';
import { focusQuestionAnswer } from '../../../../context/focusQuestionAnswer';
import { noteIdOfThread } from '../../../../resolve/notes/noteThread';
import { commentBranchPlaceOf } from '../../../../review/commentBranchPlaceOf';
import type { AskHandle } from '../../askHandles';

type Params = {
  readonly sessionId: SessionId;
};

type AgentChipParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const agentChipPlace = ({ sessionId, agentId }: AgentChipParams): PlaceRequest => {
  const state = useAppStore.getState();
  if (agentHomeFor({ state, sessionId, agentId }) !== 'review') {
    return agentPlace({ sessionId, agentId });
  }
  return commentBranchPlaceOf({
    state,
    sessionId,
    threadId: resolverThread({ state, sessionId, agentId }),
  });
};

export const useAskChipOpen = ({ sessionId }: Params) =>
  useCallback(
    (handle: AskHandle): void => {
      const { navigate } = useAppStore.getState();
      const { target } = handle;
      switch (target.kind) {
        case 'agent':
          navigate({ to: agentChipPlace({ sessionId, agentId: target.agentId }) });
          return;
        case 'run':
          navigate({
            to: sessionPlace({
              sessionId,
              lens: 'workflows',
              target: { kind: 'run', runId: target.runId },
            }),
          });
          return;
        case 'question':
          focusQuestionAnswer({ sessionId, questionId: target.questionId });
          return;
        case 'comment':
          if (noteIdOfThread({ threadId: target.threadId }) !== null) {
            void useAppStore.getState().openReviewTarget({
              sessionId,
              destination: { kind: 'notes', threadIds: [target.threadId] },
            });
            return;
          }
          navigate({
            to: commentBranchPlaceOf({
              state: useAppStore.getState(),
              sessionId,
              threadId: target.threadId,
            }),
          });
          return;
        case 'pr':
          navigate({
            to: commentBranchPlaceOf({
              state: useAppStore.getState(),
              sessionId,
              threadId: null,
            }),
          });
          return;
        case 'file':
          navigate({
            to: commentBranchPlaceOf({
              state: useAppStore.getState(),
              sessionId,
              threadId: null,
              tab: 'files',
              focus: { kind: 'branch', path: target.path },
            }),
          });
          return;
        case 'artifact':
          openPlanDrawer({ sessionId, planId: target.artifactId });
          return;
        default: {
          const exhaustive: never = target;
          return exhaustive;
        }
      }
    },
    [sessionId],
  );
