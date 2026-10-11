import { useEffect, useState } from 'react';
import { TaskLinksScene } from '../TaskLinksScene';
import { useSceneClicks } from '../audit/useSceneClicks';

const OPEN_MS = 200;

const CLICK_MS = 250;

export const TaskMoveMenuScene = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  useEffect(() => {
    const interval = window.setInterval(() => {
      const chip = document.querySelector<HTMLElement>('button[aria-label^="Open NW-142"]');
      if (chip === null) {
        return;
      }
      const rect = chip.getBoundingClientRect();
      chip.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: rect.left,
          clientY: rect.bottom,
        }),
      );
      window.clearInterval(interval);
      setIsMenuOpen(true);
    }, OPEN_MS);
    return () => window.clearInterval(interval);
  }, []);
  useSceneClicks({
    isReady: isMenuOpen,
    labels: ['Move to'],
    selector: '[role="menuitem"]',
    match: 'prefix',
    intervalMs: CLICK_MS,
  });
  return <TaskLinksScene />;
};
