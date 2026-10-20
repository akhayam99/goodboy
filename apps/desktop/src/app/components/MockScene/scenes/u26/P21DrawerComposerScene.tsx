import { useEffect, useState } from 'react';
import { RIGHT_DRAWER_MIN, RIGHT_DRAWER_STORAGE_KEY } from '@goodboy/ui';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { AppFrame } from '../audit/AppFrame';
import { SESSION } from '../activityRunSeed';
import { IMPLEMENTER_ID } from '../u24/autoSceneSeed';
import { seedC07 } from '../u25/c07/c07AutoSeed';

type Props = {
  readonly theme: 'dark' | 'light';
};

const DRAFT = 'Also cover the repeated key in applyCredit.';

export const P21DrawerComposerScene = ({ theme }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    applyDocumentTheme({ theme });
    localStorage.setItem(RIGHT_DRAWER_STORAGE_KEY, String(RIGHT_DRAWER_MIN));
    seedC07({ state: 'working', place: 'auto', pane: 'implementer' });
    const current = useAppStore.getState();
    useAppStore.setState({
      sessions: [{ ...SESSION, permissionMode: 'bypassPermissions' }],
      agentProviderOverride: { ...current.agentProviderOverride, [IMPLEMENTER_ID]: 'anthropic' },
      agentModelOverride: { ...current.agentModelOverride, [IMPLEMENTER_ID]: 'opus-5.5' },
      agentDraft: { ...current.agentDraft, [IMPLEMENTER_ID]: DRAFT },
    });
    setIsReady(true);
  }, [theme]);
  if (!isReady) {
    return null;
  }
  return <AppFrame view="session" isRailCollapsed={false} hasPane />;
};
