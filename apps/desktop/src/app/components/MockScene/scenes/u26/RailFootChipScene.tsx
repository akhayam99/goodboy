import { useEffect } from 'react';
import { RailFootScene } from './RailFootScene';

const POLL_MS = 250;

export const RailFootChipScene = () => {
  useEffect(() => {
    const timer = window.setInterval(() => {
      const chip = document.querySelector<HTMLElement>('[data-session-spend]');
      if (chip === null) {
        return;
      }
      window.clearInterval(timer);
      chip.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return <RailFootScene isArchiveAsking={false} />;
};
