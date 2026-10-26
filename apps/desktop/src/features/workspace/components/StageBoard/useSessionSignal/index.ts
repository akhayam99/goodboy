import type { Session } from '@goodboy/types';
import {
  useAppStore,
  useSessionPrFetchState,
  useSessionRequestHost,
  useSessionStageInfo,
} from '../../../../../store';
import { runningAgentCountOf } from '../../../../../store/runtime/live-work/runningAgentCountOf';
import { getLinkedRequest } from '../StageBoardCard/getLinkedRequest';
import { boardSignalOf, type BoardSignal } from '../boardSignalOf';

type Params = {
  readonly session: Session;
  readonly isArchived: boolean;
};

export const useSessionSignal = ({ session, isArchived }: Params): BoardSignal => {
  const id = session.id;
  const info = useSessionStageInfo(session);
  const pullRequest = useAppStore((s) => s.sessionGithub[id]?.pr ?? null);
  const mergeRequest = useAppStore((s) => s.sessionGitlabMr[id]?.mr ?? null);
  const prFetchState = useSessionPrFetchState(id);
  const requestHost = useSessionRequestHost({ sessionId: id });
  const runningCount = useAppStore((s) => runningAgentCountOf({ state: s, sessionId: id }));
  return boardSignalOf({
    info,
    request: getLinkedRequest({ pullRequest, mergeRequest }),
    prFetchState,
    requestHost,
    runningCount,
    isArchived,
  });
};
