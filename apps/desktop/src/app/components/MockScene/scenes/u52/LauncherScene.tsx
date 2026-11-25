import { useEffect, useState } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { StartRunScene } from '../u28/StartRunScene';
import { StartPageScene } from '../u27/startPage/StartPageScene';
import { START_PAGE_SEED } from '../u27/startPage/startPageSeedData';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly screen: 'new' | 'run';
  readonly isChangeOpen: boolean;
};

const RUN_ASK = 'Which handler in notify-relay fires the duplicate credit twice?';

const NEW_DRAFT = {
  startKind: 'auto',
  workflowGoal: START_PAGE_SEED.goal,
} as const;

export const LauncherScene = ({ theme, screen, isChangeOpen }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyDocumentTheme({ theme });
    setIsReady(true);
  }, [theme]);

  if (!isReady) {
    return null;
  }
  if (screen === 'new') {
    return <StartPageScene draft={NEW_DRAFT} />;
  }
  return <StartRunScene text={RUN_ASK} openLabels={isChangeOpen ? ['Change'] : []} />;
};
