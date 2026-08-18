import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';
import type { RunIdentity } from '../../../../timeline/runIdentity';

type Props = {
  readonly identity: RunIdentity | null;
  readonly marker?: ReactNode;
};

export const TimelineSpine = ({ identity, marker }: Props) => (
  <span className="relative w-5 shrink-0" aria-hidden={marker === undefined}>
    <span
      className={cn(
        'absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-full',
        identity === null ? 'w-px bg-border' : cn('w-1', identity.spine),
      )}
    />
    {marker !== undefined ? (
      <span className="absolute left-1/2 top-4 z-10 -translate-x-1/2 -translate-y-1/2">
        {marker}
      </span>
    ) : null}
  </span>
);
