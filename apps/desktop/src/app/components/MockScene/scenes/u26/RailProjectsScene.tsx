import { useEffect } from 'react';
import { useAppStore } from '../../../../../store';
import { SidebarNavColumnScene } from '../u23/SidebarNavColumnScene';
import { seedProjectsCard } from './seedProjectsCard';

type Opens = 'none' | 'picker' | 'focus';

type Props = {
  readonly opens: Opens;
};

const CONFIG = { branches: 1, pinCount: 1 } as const;

const OPEN_DELAY_MS = 250;

const seed = (): void => {
  const state = useAppStore.getState();
  const sessionId = state.currentSessionId;
  const workspaceId = state.currentWorkspaceId;
  if (sessionId === null || workspaceId === null) {
    return;
  }
  seedProjectsCard({ sessionId, workspaceId });
};

const SELECTORS: Readonly<Record<Exclude<Opens, 'none'>, string>> = {
  picker: '[data-level-card] button[aria-label="Add folder"]',
  focus: 'button[aria-label="New branch in ledger-core"]',
};

export const RailProjectsScene = ({ opens }: Props) => {
  useEffect(() => {
    if (opens === 'none') {
      return;
    }
    const timer = window.setInterval(() => {
      const target = document.querySelector<HTMLButtonElement>(SELECTORS[opens]);
      if (target === null) {
        return;
      }
      window.clearInterval(timer);
      if (opens === 'picker') {
        target.click();
        return;
      }
      target.focus();
    }, OPEN_DELAY_MS);
    return () => window.clearInterval(timer);
  }, [opens]);

  return <SidebarNavColumnScene config={CONFIG} isFramed isSessionLevel onSeeded={seed} />;
};
