import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { branchPlace, sessionPlace, useAppStore } from '../../../../../store';
import { useQuestionOpeners } from '../../../../context/useQuestionOpeners';
import { openReview } from '../../../../review/openReview';
import type { useTimelineOpen } from '../../../hooks/useTimelineOpen';
import type { NeedsYouOwner } from '../../../timeline/needsYou';

type Params = {
  readonly sessionId: SessionId;
  readonly openTargetFor: ReturnType<typeof useTimelineOpen>;
};

type OwnerParams = {
  readonly owner: NeedsYouOwner;
};

export type OpenNeedsYou = (params: OwnerParams) => void;

export const useOpenNeedsYou = ({ sessionId, openTargetFor }: Params): OpenNeedsYou => {
  const navigate = useAppStore((s) => s.navigate);
  const { focusQuestion, openAgentQuestion } = useQuestionOpeners({ sessionId });

  return useCallback(
    ({ owner }) => {
      if (owner.kind === 'fixRun') {
        const target = owner.owed?.target ?? null;
        if (target === null) {
          navigate({ to: branchPlace({ sessionId, tab: 'comments' }) });
          return;
        }
        void openReview({
          sessionId,
          destination: {
            kind: 'threads',
            mountId: target.mountId,
            threadIds: [target.threadId],
          },
        });
        return;
      }
      if (owner.kind === 'question') {
        if (owner.question !== null) {
          focusQuestion(owner.question.id);
        }
        navigate({ to: sessionPlace({ sessionId, lens: 'questions' }) });
        return;
      }
      if (owner.question !== null) {
        openAgentQuestion({ question: owner.question });
        return;
      }
      if (owner.item !== null) {
        openTargetFor({ entry: owner.item.entry })?.open();
      }
    },
    [focusQuestion, navigate, openAgentQuestion, openTargetFor, sessionId],
  );
};
