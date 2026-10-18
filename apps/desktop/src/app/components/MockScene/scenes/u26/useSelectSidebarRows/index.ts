import { useEffect } from 'react';

const POLL_MS = 150;
const PICKED = [1, 2, 4] as const;

type Params = {
  readonly isEnabled: boolean;
};

export const useSelectSidebarRows = ({ isEnabled }: Params): void => {
  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    let step = 0;
    const interval = window.setInterval(() => {
      const rows = document.querySelectorAll<HTMLElement>('[role="option"][data-select-id]');
      const index = PICKED[step];
      if (index === undefined) {
        window.clearInterval(interval);
        return;
      }
      const row = rows[index];
      if (row === undefined) {
        return;
      }
      row.dispatchEvent(new MouseEvent('click', { bubbles: true, altKey: true }));
      step += 1;
    }, POLL_MS);
    return () => window.clearInterval(interval);
  }, [isEnabled]);
};
