import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../store';
import { AppFrame } from '../audit/AppFrame';
import { FLOW_SESSION_ID } from '../flow-audit/fixtures';
import { seedFlowSession } from '../flow-audit/seeds';
import { seedStudioChrome } from '../shellChrome';

export type P9SlotView = 'session' | 'inbox' | 'spend' | 'workflows';

type Props = {
  readonly view: P9SlotView;
};

export const P9SlotScene = ({ view }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedFlowSession();
    seedStudioChrome();
    useAppStore.getState().openDrawer({
      kind: 'context',
      sessionId: FLOW_SESSION_ID,
      payload: { section: 'goal', view: 'current' },
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return <AppFrame view={view} isRailCollapsed={false} hasPane />;
};
