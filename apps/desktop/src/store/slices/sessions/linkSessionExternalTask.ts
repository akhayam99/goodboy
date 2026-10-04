import type { SessionExternalTask, SessionId } from '@goodboy/types';
import { writeSessionExternalTask } from './writeSessionExternalTask';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

export const linkSessionExternalTask = ({ set, get }: Params) => {
  const write = writeSessionExternalTask({ set, get });
  return async (
    sessionId: SessionId,
    task: Omit<SessionExternalTask, 'sessionId'>,
  ): Promise<void> => {
    const linkedTask = await write({ sessionId, task });
    await get().recordSessionEvent({
      sessionId,
      kind: 'issue_linked',
      payload: {
        provider: linkedTask.provider,
        identifier: linkedTask.identifier,
        title: linkedTask.title,
        url: linkedTask.url,
      },
    });
  };
};
