import type { MountId, SessionId } from '@goodboy/types';
import type { GetFn } from '../../slice-types';
import { refreshMountRequests } from './refreshMountRequests';
import { requestHostOf } from './requestHostOf';

type Params = Readonly<{
  get: GetFn;
  sessionId: SessionId;
  mountId?: MountId;
}>;

export const refreshActiveRequest = async ({ get, sessionId, mountId }: Params): Promise<void> => {
  const options = { force: true, ...(mountId === undefined ? {} : { mountId }) };
  const host = requestHostOf({
    state: get(),
    sessionId,
    ...(mountId === undefined ? {} : { mountId }),
  });
  await refreshMountRequests({ get, host, sessionId, options });
};
