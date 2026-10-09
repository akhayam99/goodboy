import type { MountId, SessionId } from '@goodboy/types';
import { refreshActiveRequest } from '../review-source/refreshActiveRequest';
import { prWriteContext } from './prWriteContext';
import { runPortWrite } from './runPortWrite';
import type { GetFn, SetFn } from './types';

export type EditPrOptions = {
  title?: string;
  body?: string;
  isQuiet?: boolean;
  mountId?: MountId;
};

export const editPr = (_set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, prNumber: number, opts: EditPrOptions) => {
    const { session, port } = prWriteContext({
      get,
      sessionId,
      prNumber,
      ...(opts.mountId === undefined ? {} : { mountId: opts.mountId }),
      failureTitle: ({ nouns }) => `Couldn't edit the ${nouns.long}`,
    });

    if (opts.title === undefined && opts.body === undefined) {
      return;
    }

    await runPortWrite({
      get,
      sessionId,
      workspaceId: session.workspaceId,
      title: `Couldn't edit the ${port.nouns.long}`,
      isQuiet: opts.isQuiet === true,
      run: async () => {
        if (opts.title !== undefined) {
          await port.updateTitle({ title: opts.title });
        }
        if (opts.body !== undefined) {
          await port.updateBody({ body: opts.body });
        }
      },
    });
    await refreshActiveRequest({ get, sessionId });
  };
};
