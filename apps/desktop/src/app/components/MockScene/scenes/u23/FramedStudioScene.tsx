import { useEffect, useState, type ReactNode } from 'react';
import type { StudioKind } from '../../../../../store';
import { StudioFrame as AppStudioFrame } from '../../../StudioFrame';
import { StudioFrame as ShellStudioFrame } from '../StudioFrame';
import { seedWorkflowBuilder } from '../flow-audit/seeds';
import { seedStudioChrome } from '../shellChrome';

const noop = () => undefined;

type Props = {
  readonly kind: StudioKind;
  readonly place: 'inbox' | 'workflows' | 'impact' | 'changelog' | 'link';
  readonly seed?: () => void;
  readonly children: ReactNode;
};

export const FramedStudioScene = ({ kind, place, seed, children }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedWorkflowBuilder();
    seedStudioChrome();
    seed?.();
    setIsReady(true);
  }, [seed]);

  if (!isReady) {
    return null;
  }

  return (
    <ShellStudioFrame
      target={{ place, tool: null }}
      main={
        <AppStudioFrame kind={kind} onClose={noop}>
          {children}
        </AppStudioFrame>
      }
    />
  );
};
