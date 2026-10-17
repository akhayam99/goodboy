import { useEffect, useState } from 'react';
import { AppFrame } from '../audit/AppFrame';
import { seedFrame } from '../audit/frameSeed';
import { LevelsScene } from './c02LevelsScene';

const WORKSPACE = { place: 'board', branches: 3 } as const;
const SESSION = { isBusy: true } as const;
const AGENTS = { isBusy: true, lens: 'agents' } as const;
const BRANCHLESS = { branches: 0 } as const;
const MAIN_FOLDED = { isBusy: true, isMainFolded: true } as const;
const FOLDED = { isBusy: true, isRailFolded: true } as const;
const STUDIO_OVER = { isBusy: true, place: 'inbox' } as const;

const ShellOverview = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedFrame({ context: 'session' });
    setIsReady(true);
  }, []);
  if (!isReady) {
    return null;
  }
  return <AppFrame view="session" isRailCollapsed={false} />;
};

export const U25_C02_LEVEL_SCENES = {
  'c02-level-workspace': () => <LevelsScene config={WORKSPACE} />,
  'c02-level-session': () => <LevelsScene config={SESSION} />,
  'c02-level-session-agents': () => <LevelsScene config={AGENTS} />,
  'c02-level-branchless': () => <LevelsScene config={BRANCHLESS} />,
  'c02-level-main-folded': () => <LevelsScene config={MAIN_FOLDED} />,
  'c02-level-folded': () => <LevelsScene config={FOLDED} />,
  'c02-level-studio-over': () => <LevelsScene config={STUDIO_OVER} />,
  'c02-shell-overview': ShellOverview,
};
