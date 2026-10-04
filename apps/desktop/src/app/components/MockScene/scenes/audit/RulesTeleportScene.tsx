import { useEffect, useState } from 'react';
import { AppFrame } from './AppFrame';
import { seedFrame } from './frameSeed';

export const RulesTeleportScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedFrame({ context: 'board' });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }
  return <AppFrame view="settings" isRailCollapsed={false} />;
};
