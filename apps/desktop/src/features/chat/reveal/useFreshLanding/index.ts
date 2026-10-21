import { useState } from 'react';
import type { CSSProperties } from 'react';
import { liveTextRegistry } from '../liveTextRegistry';
import { REVEAL_PACE } from '../revealNumbers';

type Params = {
  readonly liveKey: string | null;
  readonly text: string;
};

type FreshFade = {
  readonly 'data-fresh': '';
  readonly style: CSSProperties;
};

type FreshLanding = {
  readonly fadeKey: string;
  readonly fade: FreshFade | undefined;
};

type Landing = {
  readonly text: string;
  readonly version: number;
  readonly isFresh: boolean;
};

const FADE: FreshFade = {
  'data-fresh': '',
  style: { animationDuration: `${REVEAL_PACE.fadeMs}ms` },
};

type LandParams = Params & {
  readonly version: number;
};

const land = ({ liveKey, text, version }: LandParams): Landing => ({
  text,
  version,
  isFresh: text !== '' && liveKey !== null && liveTextRegistry.isLanding({ runId: liveKey }),
});

export const useFreshLanding = ({ liveKey, text }: Params): FreshLanding => {
  const [landing, setLanding] = useState<Landing>(() => land({ liveKey, text, version: 0 }));
  if (landing.text !== text) {
    const next = land({ liveKey, text, version: landing.version + 1 });
    setLanding(next);
    return { fadeKey: `${next.version}`, fade: next.isFresh ? FADE : undefined };
  }
  return { fadeKey: `${landing.version}`, fade: landing.isFresh ? FADE : undefined };
};
