type Params = {
  readonly now: () => number;
};

export type PlaybackClock = {
  readonly elapsed: () => number;
  readonly isRunning: () => boolean;
  readonly resume: () => void;
  readonly pause: () => void;
  readonly reset: () => void;
};

export const createPlaybackClock = ({ now }: Params): PlaybackClock => {
  let banked = 0;
  let startedAt: number | null = null;
  const sinceStart = (): number => (startedAt === null ? 0 : Math.max(0, now() - startedAt));
  return {
    elapsed: () => banked + sinceStart(),
    isRunning: () => startedAt !== null,
    resume: () => {
      if (startedAt !== null) {
        return;
      }
      startedAt = now();
    },
    pause: () => {
      if (startedAt === null) {
        return;
      }
      banked += sinceStart();
      startedAt = null;
    },
    reset: () => {
      banked = 0;
      startedAt = null;
    },
  };
};
