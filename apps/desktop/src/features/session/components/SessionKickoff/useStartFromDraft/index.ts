import { useCallback } from 'react';
import { inlineMarkdownText } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sessionPlace } from '../../../../../store/slices/navigation/place';
import type {
  SessionDraftStart,
  StartSessionFromDraftParams,
} from '../../../../../store/slices/sessionDraft/startSessionFromDraft';
import { useFollowToast } from '../../../../../shared/hooks/useFollowToast';

const STARTED_SESSION_TITLE = 'Session started';

const STARTED_RUN_TITLE = 'Run started';

type TitleParams = {
  readonly start: SessionDraftStart;
};

const startedTitleOf = ({ start }: TitleParams): string => {
  if (start.kind === 'workflow-run') {
    return STARTED_RUN_TITLE;
  }
  if (start.kind === 'task' && start.then?.kind === 'workflow-run') {
    return STARTED_RUN_TITLE;
  }
  return STARTED_SESSION_TITLE;
};

export const useStartFromDraft = (): ((
  params: StartSessionFromDraftParams,
) => Promise<Session>) => {
  const startSessionFromDraft = useAppStore((state) => state.startSessionFromDraft);
  const followStart = useFollowToast();
  return useCallback(
    async (params: StartSessionFromDraftParams): Promise<Session> => {
      const session = await startSessionFromDraft(params);
      followStart({
        title: startedTitleOf({ start: params.start }),
        message: inlineMarkdownText({ text: session.goal }),
        target: { place: sessionPlace({ sessionId: session.id }) },
        startKey: session.id,
      });
      return session;
    },
    [followStart, startSessionFromDraft],
  );
};
