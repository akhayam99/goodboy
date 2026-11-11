import { useEffect, useState, type ReactNode } from 'react';
import type { StudioKind } from '../../../../../store';
import { StudioFrame as AppStudioFrame } from '../../../StudioFrame';
import { StudioFrame as ShellStudioFrame } from '../StudioFrame';
import { FLOW_SESSION_ID } from '../flow-audit/fixtures';
import { seedFlowSession } from '../flow-audit/seeds';
import type { ColumnPlace } from '../../../../../shared/navigation/columnPlace';
import { seedStudioChrome } from '../shellChrome';

const noop = () => undefined;

type Props = {
  readonly kind: StudioKind;
  readonly place: 'inbox' | 'workflows' | 'impact' | 'changelog' | 'link' | 'guide';
  readonly columnPlace?: ColumnPlace;
  readonly seed?: () => void;
  readonly children: ReactNode;
};

export const FramedStudioScene = ({ kind, place, columnPlace, seed, children }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedFlowSession();
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
      currentSessionId={FLOW_SESSION_ID}
      {...(columnPlace !== undefined && { columnPlace })}
      main={
        <AppStudioFrame kind={kind} onClose={noop}>
          {children}
        </AppStudioFrame>
      }
    />
  );
};
