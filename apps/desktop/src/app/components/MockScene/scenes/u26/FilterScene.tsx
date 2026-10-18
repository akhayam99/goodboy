import { useEffect } from 'react';
import { useAppStore } from '../../../../../store';
import { SidebarNavColumnScene } from '../u23/SidebarNavColumnScene';

type Props = {
  readonly isActive: boolean;
};

const CONFIG = { pinCount: 3, hasQuestion: true } as const;

const OPEN_DELAY_MS = 250;

const filterOn = (): void => {
  const state = useAppStore.getState();
  const workspaceId = state.currentWorkspaceId;
  if (workspaceId === null) {
    return;
  }
  state.setSessionViewPrefs({
    workspaceId,
    patch: { statusFilter: ['attention'], sort: 'updatedAt', isArchivedShown: true },
  });
};

export const FilterScene = ({ isActive }: Props) => {
  useEffect(() => {
    const timer = window.setInterval(() => {
      const trigger = document.querySelector<HTMLButtonElement>(
        '[data-door-action="board"] button[aria-label="Filter sessions"]',
      );
      if (trigger === null) {
        return;
      }
      window.clearInterval(timer);
      if (isActive) {
        filterOn();
      }
      trigger.click();
    }, OPEN_DELAY_MS);
    return () => window.clearInterval(timer);
  }, [isActive]);

  return <SidebarNavColumnScene config={CONFIG} />;
};
