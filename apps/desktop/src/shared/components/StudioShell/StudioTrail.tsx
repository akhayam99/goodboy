import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Trail, type TrailSegmentModel } from '@goodboy/ui';
import { useStudioFrame } from './studioFrameContext';
import { studioUpSlot } from './studioUpSlot';

type Props = {
  readonly segments: ReadonlyArray<TrailSegmentModel>;
  readonly accessory?: ReactNode;
};

export const StudioTrail = ({ segments, accessory }: Props) => {
  const frame = useStudioFrame();
  const claimTrail = frame?.claimTrail ?? null;
  const isInStudio = frame != null;
  const parentUpRef = useRef<(() => void) | null>(null);
  parentUpRef.current = segments.at(-2)?.onSelect ?? null;

  useLayoutEffect(() => {
    if (claimTrail == null) {
      return;
    }
    return claimTrail();
  }, [claimTrail]);

  useLayoutEffect(() => {
    if (!isInStudio) {
      return;
    }
    return studioUpSlot.claim({ up: () => parentUpRef.current });
  }, [isInStudio]);

  const trail = (
    <div className="flex h-6 min-w-0 flex-1 items-center gap-2">
      <Trail segments={segments} />
      {accessory}
    </div>
  );

  if (frame == null) {
    return trail;
  }
  if (frame.trailSlot == null) {
    return null;
  }
  return createPortal(trail, frame.trailSlot);
};
