import { DetachedStudio } from './DetachedStudio';
import { FramedStudio } from './FramedStudio';
import { useStudioFrame } from './studioFrameContext';
import type { StudioShellProps } from './types';

export const StudioShell = (props: StudioShellProps) => {
  const frame = useStudioFrame();
  const isFramed = frame !== null && (props.variant ?? 'fullscreen') === 'fullscreen';
  return isFramed ? <FramedStudio {...props} frame={frame} /> : <DetachedStudio {...props} />;
};
