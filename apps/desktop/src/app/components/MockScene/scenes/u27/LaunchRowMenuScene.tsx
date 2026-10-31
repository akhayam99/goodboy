import { useEffect } from 'react';
import { ObjectMenuProvider } from '../../../../../features/actions/components/ObjectMenuProvider';
import { SpawnedPanelScene } from '../u26/SpawnedPanelScene';

const OPEN_DELAY_MS = 250;

const openLaunchMenu = (): boolean => {
  const row = document.querySelector<HTMLElement>(
    '[data-spawned-tree] [role="treeitem"][data-agent-id]',
  );
  if (row === null) {
    return false;
  }
  const rect = row.getBoundingClientRect();
  row.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 2 }));
  row.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }),
  );
  return true;
};

export const LaunchRowMenuScene = () => {
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (openLaunchMenu()) {
        window.clearInterval(timer);
      }
    }, OPEN_DELAY_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <ObjectMenuProvider>
      <SpawnedPanelScene theme="light" view="auto" />
    </ObjectMenuProvider>
  );
};
