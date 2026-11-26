import type { CanDropParams } from './dockDropZonesOf';

type Probe = (params: CanDropParams) => boolean;

type ProbeParams = {
  readonly probe: Probe;
};

type FitParams = Pick<CanDropParams, 'columns'> & Partial<Pick<CanDropParams, 'groups'>>;

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
  fits: ({ columns, groups = {} }: FitParams): boolean =>
    current === null || current({ columns, groups }),
};
