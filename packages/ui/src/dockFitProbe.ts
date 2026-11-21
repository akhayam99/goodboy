import type { CanDropParams } from './dockDropZonesOf';

type Probe = (params: CanDropParams) => boolean;

type ProbeParams = {
  readonly probe: Probe;
};

let current: Probe | null = null;

export const dockFitProbe = {
  publish: ({ probe }: ProbeParams): (() => void) => {
    current = probe;
    return () => {
      if (current === probe) {
        current = null;
      }
    };
  },
  fits: ({ columns }: CanDropParams): boolean => current === null || current({ columns }),
};
