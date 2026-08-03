import { ArrowLeft } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { GhostActionButton } from '../GhostActionButton';

type Props = {
  readonly sessionId: SessionId;
};

export const WorkSurfaceBackButton = ({ sessionId }: Props) => {
  const canGoBack = useAppStore((state) => (state.lensHistory[sessionId]?.index ?? 0) > 0);
  const lensGo = useAppStore((state) => state.lensGo);

  if (canGoBack === false) {
    return null;
  }

  return (
    <GhostActionButton
      icon={ArrowLeft}
      label="Back"
      title="Back to where you were"
      onClick={() => lensGo(sessionId, -1)}
    />
  );
};
