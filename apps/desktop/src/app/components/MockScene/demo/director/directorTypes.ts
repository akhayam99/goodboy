import type { IsoDateTime } from '@goodboy/types';
import type { useAppStore } from '../../../../../store';
import type { AppStore } from '../../../../../store/store';

export type DirectorStore = Pick<typeof useAppStore, 'getState' | 'setState'>;

export type HintParams = {
  readonly text: string;
};

export type CueParams = {
  readonly store: DirectorStore;
  readonly at: IsoDateTime;
  readonly hint: (params: HintParams) => void;
};

export type SetupParams = {
  readonly store: DirectorStore;
};

export type DemoCue = {
  readonly atMs: number;
  readonly apply: (params: CueParams) => void;
};

export type DemoTimeline = {
  readonly setup?: (params: SetupParams) => void;
  readonly prepare: (params: CueParams) => void;
  readonly cues: ReadonlyArray<DemoCue>;
  readonly reply?: string;
};

export type TimelineParams = {
  readonly state: AppStore;
};
