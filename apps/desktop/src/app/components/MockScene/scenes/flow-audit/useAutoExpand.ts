import { useEffect } from 'react';

type ExpandParams = Readonly<{
  isReady: boolean;
  selector: string;
}>;

export const useAutoExpand = ({ isReady, selector }: ExpandParams) => {
  useEffect(() => {
    if (!isReady) {
      return;
    }
    const interval = window.setInterval(() => {
      const toggle = window.document.querySelector<HTMLButtonElement>(selector);
      if (toggle === null) {
        return;
      }
      if (toggle.getAttribute('aria-expanded') !== 'true') {
        toggle.click();
      }
      window.clearInterval(interval);
    }, 120);
    return () => window.clearInterval(interval);
  }, [isReady, selector]);
};
