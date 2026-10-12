import { enqueuePortWrite } from './enqueuePortWrite';
import { writeHiddenPorts } from './writeHiddenPorts';
import type { HidePortParams } from './types';
import type { SliceDeps } from '../../slice-types';

export const unhidePort = ({ set, get }: SliceDeps) => {
  return ({ port, source }: HidePortParams): Promise<void> =>
    enqueuePortWrite({
      task: async () => {
        const current = get().monitorHidden;
        const next = current.filter((item) => item.port !== port || item.source !== source);
        if (next.length === current.length) {
          return;
        }
        await writeHiddenPorts({ set, get, next, failureTitle: "Couldn't show the port" });
      },
    });
};
