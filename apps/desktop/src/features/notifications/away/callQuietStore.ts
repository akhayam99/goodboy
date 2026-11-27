import { create } from 'zustand';
import type { AwayBanner } from './awayBannersOf';
import type { CallQuiet } from './heldDuringCall';

type StartParams = {
  readonly quiet: CallQuiet;
};

type HoldParams = {
  readonly banners: ReadonlyArray<AwayBanner>;
};

type EndParams = {
  readonly eventId: string;
};

type CallQuietState = {
  readonly quiet: CallQuiet | null;
  readonly held: ReadonlyArray<AwayBanner>;
  readonly startQuiet: (params: StartParams) => void;
  readonly hold: (params: HoldParams) => void;
  readonly endQuiet: (params: EndParams) => ReadonlyArray<AwayBanner>;
};

export const useCallQuietStore = create<CallQuietState>((set, get) => ({
  quiet: null,
  held: [],
  startQuiet: ({ quiet }) => {
    set((state) => ({ quiet, held: state.quiet === null ? [] : state.held }));
  },
  hold: ({ banners }) => {
    if (banners.length === 0) {
      return;
    }
    set((state) => ({ held: [...state.held, ...banners] }));
  },
  endQuiet: ({ eventId }) => {
    const { quiet, held } = get();
    if (quiet === null || quiet.eventId !== eventId) {
      return [];
    }
    set({ quiet: null, held: [] });
    return held;
  },
}));
