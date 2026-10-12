import { enqueuePortWrite } from './enqueuePortWrite';
import { isValidPort } from './isValidPort';
import { writeHiddenPorts } from './writeHiddenPorts';
import type { HidePortParams } from './types';
import type { SliceDeps } from '../../slice-types';

export const hidePort = ({ set, get }: SliceDeps) => {
  return ({ port, source }: HidePortParams): Promise<void> =>
    enqueuePortWrite({
      task: async () => {
        const current = get().monitorHidden;
        if (
          !isValidPort({ port }) ||
          current.some((item) => item.port === port && item.source === source)
        ) {
          return;
        }
        const next = [...current, { port, source }];
        const isWritten = await writeHiddenPorts({
          set,
          get,
          next,
          failureTitle: "Couldn't hide the port",
        });
        if (!isWritten) {
          return;
        }
        get().undoable({
          message: `Hid :${port}`,
          isCurrent: () => get().monitorHidden === next,
          undo: () => get().unhidePort({ port, source }),
        });
      },
    });
};
