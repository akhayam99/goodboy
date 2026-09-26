import { useLayoutEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Trail, type TrailSegmentModel } from '@goodboy/ui';
import { useStudioFrame } from './studioFrameContext';

type Props = {
  readonly segments: ReadonlyArray<TrailSegmentModel>;
  readonly accessory?: ReactNode;
};

export const StudioTrail = ({ segments, accessory }: Props) => {
  const frame = useStudioFrame();
  const claimTrail = frame?.claimTrail ?? null;

  useLayoutEffect(() => {
    if (claimTrail == null) {
      return;
    }
    return claimTrail();
  }, [claimTrail]);

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
