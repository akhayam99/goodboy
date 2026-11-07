import { useEffect } from 'react';
import { ActivityRunScene } from '../../ActivityRunScene';

export const ContextMenuScene = () => {
  useEffect(() => {
    const open = () => {
      const trigger = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Decisions actions"]',
      );
      if (trigger === null) {
        return;
      }
      observer.disconnect();
      trigger.click();
    };
    const observer = new MutationObserver(open);
    observer.observe(document.body, { childList: true, subtree: true });
    open();
    return () => observer.disconnect();
  }, []);
  return <ActivityRunScene contextSection="goal" />;
};
