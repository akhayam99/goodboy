import { enqueuePortWrite } from './enqueuePortWrite';
import { writeHiddenPorts } from './writeHiddenPorts';
import type { SliceDeps } from '../../slice-types';

export const showHiddenPorts = ({ set, get }: SliceDeps) => {
  return (): Promise<void> =>
    enqueuePortWrite({
      task: async () => {
        if (get().monitorHidden.length === 0) {
          return;
        }
        await writeHiddenPorts({ set, get, next: [], failureTitle: "Couldn't show the ports" });
      },
    });
};
