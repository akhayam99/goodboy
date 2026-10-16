import { useEffect } from 'react';
import { ActivityRunScene } from '../ActivityRunScene';

const OPEN_MENU_DELAY_MS = 250;

export const C10NewMenuScene = () => {
  useEffect(() => {
    const timer = window.setInterval(() => {
      const trigger = [
        ...document.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="menu"]'),
      ].find((button) => button.textContent?.trim() === 'New');
      if (trigger === undefined) {
        return;
      }
      trigger.click();
      window.clearInterval(timer);
    }, OPEN_MENU_DELAY_MS);
    return () => window.clearInterval(timer);
  }, []);

  return <ActivityRunScene />;
};
