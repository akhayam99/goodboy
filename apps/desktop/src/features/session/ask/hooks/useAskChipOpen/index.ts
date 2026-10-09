import { useCallback } from 'react';
import type { AgentId, ArtifactId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { agentHomeFor } from '../../../../../store/slices/navigation/agentHomeFor';
import {
  agentPlace,
  branchPlace,
  sessionPlace,
} from '../../../../../store/slices/navigation/place';
import { resolverThread } from '../../../../../store/slices/navigation/resolverThread';
import type { PlaceRequest } from '../../../../../store/slices/navigation/types';
import { focusQuestionAnswer } from '../../../../context/focusQuestionAnswer';
import { noteIdOfThread } from '../../../../resolve/notes/noteThread';
import type { AskHandle } from '../../askHandles';

type Params = {
  readonly sessionId: SessionId;
  readonly onOpenInside: (artifactId: ArtifactId) => void;
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
  return branchPlace({
    sessionId,
    tab: 'comments',
    threadId: resolverThread({ state, sessionId, agentId }),
  });
};

export const useAskChipOpen = ({ sessionId, onOpenInside }: Params) =>
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
          focusQuestionAnswer({ questionId: target.questionId });
          navigate({ to: sessionPlace({ sessionId, lens: 'questions' }) });
          return;
        case 'comment':
          if (noteIdOfThread({ threadId: target.threadId }) !== null) {
            void useAppStore.getState().openReviewTarget({
              sessionId,
              destination: { kind: 'notes', threadIds: [target.threadId] },
            });
            return;
          }
          navigate({ to: branchPlace({ sessionId, tab: 'comments', threadId: target.threadId }) });
          return;
        case 'pr':
          navigate({ to: branchPlace({ sessionId, tab: 'comments' }) });
          return;
        case 'file':
          navigate({
            to: branchPlace({
              sessionId,
              tab: 'files',
              focus: { kind: 'branch', path: target.path },
            }),
          });
          return;
        case 'artifact':
          onOpenInside(target.artifactId);
          return;
        default: {
          const exhaustive: never = target;
          return exhaustive;
        }
      }
    },
    [onOpenInside, sessionId],
  );
