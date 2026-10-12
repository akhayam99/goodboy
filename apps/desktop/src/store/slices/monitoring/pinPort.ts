import { enqueuePortWrite } from './enqueuePortWrite';
import { isValidPort } from './isValidPort';
import { normalizeDescription } from './pinDescription';
import { writePinnedPorts } from './writePinnedPorts';
import type { PinPortParams } from './types';
import type { SliceDeps } from '../../slice-types';

export const pinPort = ({ set, get }: SliceDeps) => {
  return ({ port, description }: PinPortParams): Promise<boolean> =>
    enqueuePortWrite({
      task: async () => {
        if (!isValidPort({ port })) {
          return false;
        }
        const text = normalizeDescription({ text: description });
        const current = get().monitorPinned;
        if (current.find((pin) => pin.port === port)?.description === text) {
          return true;
        }
        const next = [...current.filter((pin) => pin.port !== port), { port, description: text }];
        next.sort((a, b) => a.port - b.port);
        return writePinnedPorts({ set, get, next, failureTitle: "Couldn't pin the port" });
      },
    });
};
