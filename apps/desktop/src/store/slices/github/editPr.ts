import type { MountId, SessionId } from '@goodboy/types';
import { prWriteContext } from './prWriteContext';
import { runPortWrite } from './runPortWrite';
import type { GetFn, SetFn } from './types';

const EDIT_FAILURE_TITLE = "Couldn't edit the pull request";

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
      failureTitle: () => EDIT_FAILURE_TITLE,
    });

    if (opts.title === undefined && opts.body === undefined) {
      return;
    }

    await runPortWrite({
      get,
      sessionId,
      workspaceId: session.workspaceId,
      title: EDIT_FAILURE_TITLE,
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
    await get().refreshSessionPr(sessionId, { force: true });
  };
};
