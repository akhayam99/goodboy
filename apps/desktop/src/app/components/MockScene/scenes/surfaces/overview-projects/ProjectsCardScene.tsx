import { useEffect, useState } from 'react';
import { useSceneClicks } from '../../audit/useSceneClicks';
import { CentralColumnScene } from '../../u26/CentralColumnScene';
import { seedCentralColumn } from '../../u26/centralColumnSeed';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly isConfirmOpen: boolean;
};

const OPEN_MS = 400;

const CLICK_MS = 250;

const CLOSE_LABELS: ReadonlyArray<string> = ['Close branch'];

const TILE = '[data-board-row] [role="link"][aria-label="Open hl/ledger-limits"]';

export const ProjectsCardScene = ({ theme, isConfirmOpen }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  useEffect(() => {
    seedCentralColumn({ kind: 'branches' });
    setIsReady(true);
    if (!isConfirmOpen) {
      return;
    }
    const interval = window.setInterval(() => {
      const tile = document.querySelector<HTMLElement>(TILE);
      if (tile === null) {
        return;
      }
      const rect = tile.getBoundingClientRect();
      tile.dispatchEvent(
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
  }, [isConfirmOpen, theme]);
  useSceneClicks({
    isReady: isMenuOpen,
    labels: CLOSE_LABELS,
    selector: '[role="menuitem"]',
    match: 'prefix',
    intervalMs: CLICK_MS,
  });
  return isReady ? <CentralColumnScene theme={theme} kind="branches" /> : null;
};
