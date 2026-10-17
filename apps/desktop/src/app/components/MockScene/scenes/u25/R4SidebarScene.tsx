import { useEffect } from 'react';
import { SidebarNavColumnScene } from '../u23/SidebarNavColumnScene';

const OPEN_DELAY_MS = 250;

const RHYTHM = { pinCount: 3 } as const;

type Opens = 'filter' | 'menu';

type Props = {
  readonly opens: Opens;
};

const openFilter = (): boolean => {
  const trigger = document.querySelector<HTMLButtonElement>(
    '[data-door-action="board"] button[aria-label="Filter sessions"]',
  );
  if (trigger === null) {
    return false;
  }
  trigger.click();
  return true;
};

const openRowMenu = (): boolean => {
  const rows = document.querySelectorAll<HTMLButtonElement>('button[data-select-id]');
  const row = rows[3] ?? rows[0];
  if (row === undefined) {
    return false;
  }
  const rect = row.getBoundingClientRect();
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

const OPENERS: Readonly<Record<Opens, () => boolean>> = {
  filter: openFilter,
  menu: openRowMenu,
};

export const R4SidebarScene = ({ opens }: Props) => {
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (OPENERS[opens]()) {
        window.clearInterval(timer);
      }
    }, OPEN_DELAY_MS);
    return () => window.clearInterval(timer);
  }, [opens]);

  return <SidebarNavColumnScene config={RHYTHM} />;
};
