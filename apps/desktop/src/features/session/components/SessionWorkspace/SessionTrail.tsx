import { useContext, useRef } from 'react';
import type { SessionId } from '@goodboy/types';
import { Trail, type TrailSegmentModel } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import type { AppState } from '../../../../store/types';
import { captureLocation } from '../../../../store/slices/navigation/captureLocation';
import { SessionRailFoldContext } from '../../sessionRailFoldContext';
import { upTrailOf } from '../../../../store/slices/navigation/upTrailOf';

type Props = {
  readonly sessionId: SessionId;
};

type TrailParams = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

type Cached = {
  readonly signature: string;
  readonly segments: ReadonlyArray<TrailSegmentModel>;
};

const NO_SEGMENTS: ReadonlyArray<TrailSegmentModel> = [];

const trailOf = ({ state, sessionId }: TrailParams): ReadonlyArray<TrailSegmentModel> => {
  const { place } = captureLocation({ state });
  if (place.at !== 'session' || place.sessionId !== sessionId) {
    return NO_SEGMENTS;
  }
  return upTrailOf({
    state,
    place,
    onUp: ({ to }) => useAppStore.getState().upTo({ to }),
  });
};

export const SessionTrail = ({ sessionId }: Props) => {
  const isRailFolded = useContext(SessionRailFoldContext);
  const cache = useRef<Cached | null>(null);
  const segments = useAppStore((state) => {
    const next = trailOf({ state, sessionId });
    const signature = next.map((segment) => `${segment.id} ${segment.label}`).join('\n');
    if (cache.current !== null && cache.current.signature === signature) {
      return cache.current.segments;
    }
    cache.current = { signature, segments: next };
    return next;
  });
  const visible = isRailFolded ? segments : segments.slice(1);
  if (visible.length === 0 || segments.length < 2) {
    return null;
  }
  return <Trail segments={visible} />;
};
