import { useEffect, useState } from 'react';
import { BootSplash } from '../../../BootSplash';
import { AppFrame } from './AppFrame';
import { frameContextOf, seedFrame } from './frameSeed';
import { sceneParam } from './sceneParams';

const noop = () => undefined;

const VIEW = sceneParam({ key: 'view' }) ?? 'board';
const CONTEXT = frameContextOf({ value: sceneParam({ key: 'ctx' }) });

type BootView = {
  readonly phase: 'detecting-cli' | 'error';
  readonly error: string | null;
};

const BOOT_VIEWS: Readonly<Record<string, BootView>> = {
  boot: { phase: 'detecting-cli', error: null },
  'boot-error': {
    phase: 'error',
    error: 'migration m162 failed: no such column: answer_delivered_at',
  },
};

export const FrameScene = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedFrame({ context: CONTEXT });
    setIsReady(true);
  }, []);

  const boot = BOOT_VIEWS[VIEW];
  if (boot !== undefined) {
    return <BootSplash phase={boot.phase} error={boot.error} onRetry={noop} />;
  }
  if (!isReady) {
    return null;
  }
  return <AppFrame view={VIEW} isRailCollapsed={CONTEXT === 'rail'} />;
};
