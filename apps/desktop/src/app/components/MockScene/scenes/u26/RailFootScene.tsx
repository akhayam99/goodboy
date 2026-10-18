import { useEffect } from 'react';
import { useAppStore } from '../../../../../store';
import { SidebarNavColumnScene } from '../u23/SidebarNavColumnScene';
import { seedSideInfoValues } from '../u25/seedSideInfoValues';

type Props = {
  readonly isArchiveAsking: boolean;
};

const CONFIG = { branches: 2, pinCount: 1 } as const;

const OPEN_DELAY_MS = 250;

const seed = (): void => {
  seedSideInfoValues();
  const sessionId = useAppStore.getState().currentSessionId;
  if (sessionId === null) {
    return;
  }
  useAppStore.setState((state) => ({
    sessionBudgets: {
      ...state.sessionBudgets,
      [sessionId]: { sessionId, softCapUsd: 10, onExceed: 'pause' },
    },
  }));
};

export const RailFootScene = ({ isArchiveAsking }: Props) => {
  useEffect(() => {
    if (!isArchiveAsking) {
      return;
    }
    const timer = window.setInterval(() => {
      const archive = document.querySelector<HTMLButtonElement>(
        '[data-session-foot-action="session.archive"]',
      );
      if (archive === null) {
        return;
      }
      window.clearInterval(timer);
      archive.click();
    }, OPEN_DELAY_MS);
    return () => window.clearInterval(timer);
  }, [isArchiveAsking]);

  return <SidebarNavColumnScene config={CONFIG} isFramed isSessionLevel onSeeded={seed} />;
};
