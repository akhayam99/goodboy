import type { TrackedEvent, TrackSpec } from './readTrackEvent';

type Params = {
  readonly tracked: TrackedEvent;
  readonly spec: TrackSpec;
};

export const dataLayerEntry = ({ tracked, spec }: Params) => {
  const cleared = Object.values(spec)
    .flatMap((rules) => Object.keys(rules))
    .map((name) => [name, undefined] as const);
  return { event: tracked.event, ...Object.fromEntries(cleared), ...tracked.params };
};
