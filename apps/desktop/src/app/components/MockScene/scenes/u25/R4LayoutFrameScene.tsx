import { useEffect, useState } from 'react';
import { AppFrame } from '../audit/AppFrame';
import { seedFrame, type FrameContext } from '../audit/frameSeed';

type Props = {
  readonly view: string;
  readonly context: FrameContext;
};

export const R4LayoutFrameScene = ({ view, context }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedFrame({ context });
    setIsReady(true);
  }, [context]);

  if (!isReady) {
    return null;
  }
  return <AppFrame view={view} isRailCollapsed={false} />;
};
