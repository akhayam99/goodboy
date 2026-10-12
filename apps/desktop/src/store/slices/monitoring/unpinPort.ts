import { enqueuePortWrite } from './enqueuePortWrite';
import { writePinnedPorts } from './writePinnedPorts';
import type { UnpinPortParams } from './types';
import type { SliceDeps } from '../../slice-types';

export const unpinPort = ({ set, get }: SliceDeps) => {
  return ({ port }: UnpinPortParams): Promise<void> =>
    enqueuePortWrite({
      task: async () => {
        const current = get().monitorPinned;
        const removed = current.find((pin) => pin.port === port);
        if (removed === undefined) {
          return;
        }
        const next = current.filter((pin) => pin.port !== port);
        const isWritten = await writePinnedPorts({
          set,
          get,
          next,
          failureTitle: "Couldn't unpin the port",
        });
        if (!isWritten) {
          return;
        }
        get().undoable({
          message: `Unpinned :${port}`,
          undo: async () => {
            if (get().monitorPinned.some((pin) => pin.port === port)) {
              return;
            }
            await get().pinPort({ port, description: removed.description });
          },
        });
      },
    });
};
