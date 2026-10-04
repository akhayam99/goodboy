import type { ProjectId, SessionExternalTaskProvider, SessionId } from '@goodboy/types';
import { removeSessionExternalTask } from './removeSessionExternalTask';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

export const unlinkSessionExternalTask = ({ set, get }: Params) => {
  const remove = removeSessionExternalTask({ set, get });
  return async (
    sessionId: SessionId,
    provider: SessionExternalTaskProvider,
    externalId: string,
    projectId?: ProjectId,
    branchLink?: string,
  ): Promise<void> => {
    const unlinked = await remove({ sessionId, provider, externalId, projectId, branchLink });
    if (unlinked == null) {
      return;
    }
    await get().recordSessionEvent({
      sessionId,
      kind: 'issue_unlinked',
      payload: {
        provider: unlinked.provider,
        identifier: unlinked.identifier,
        title: unlinked.title,
        url: unlinked.url,
      },
    });
  };
};
