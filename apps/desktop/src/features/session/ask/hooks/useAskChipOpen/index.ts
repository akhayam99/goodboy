import { useCallback } from 'react';
import type { ArtifactId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import {
  agentPlace,
  branchPlace,
  sessionPlace,
} from '../../../../../store/slices/navigation/place';
import { focusQuestionAnswer } from '../../../../context/focusQuestionAnswer';
import type { AskHandle } from '../../askHandles';

type Params = {
  readonly sessionId: SessionId;
  readonly onOpenInside: (artifactId: ArtifactId) => void;
};

export const useAskChipOpen = ({ sessionId, onOpenInside }: Params) =>
  useCallback(
    (handle: AskHandle): void => {
      const { navigate } = useAppStore.getState();
      const { target } = handle;
      switch (target.kind) {
        case 'agent':
          navigate({ to: agentPlace({ sessionId, agentId: target.agentId }) });
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
