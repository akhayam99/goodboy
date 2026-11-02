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
import { useShowToast } from '../../../../../shared/components/Toast/useShowToast';
import { selectWritableMounts } from '../../../../../store/slices/project-mounts/selectors';
import { startDepsLineOf } from './startDepsLineOf';

const STARTED_SESSION_TITLE = 'Session started';

const STARTED_RUN_TITLE = 'Run started';

const DEPS_TITLE = 'Dependencies';

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
  const showToast = useShowToast();
  return useCallback(
    async (params: StartSessionFromDraftParams): Promise<Session> => {
      const session = await startSessionFromDraft(params);
      void startDepsLineOf({
        targets: selectWritableMounts({ state: useAppStore.getState(), sessionId: session.id }),
      }).then((line) => {
        if (line !== null) {
          showToast({ kind: 'warning', title: DEPS_TITLE, message: line });
        }
      });
      followStart({
        title: startedTitleOf({ start: params.start }),
        message: inlineMarkdownText({ text: session.goal }),
        target: { place: sessionPlace({ sessionId: session.id }) },
        startKey: session.id,
      });
      return session;
    },
    [followStart, showToast, startSessionFromDraft],
  );
};
