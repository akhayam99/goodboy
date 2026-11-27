import { useEffect, type ReactNode } from 'react';

const POLL_MS = 100;

type Props = {
  readonly name: string;
  readonly children: ReactNode;
};

export const PressWhenReady = ({ name, children }: Props) => {
  useEffect(() => {
    const timer = setInterval(() => {
      const target = Array.from(document.querySelectorAll('button')).find(
        (button) => button.getAttribute('aria-label') === name || button.textContent === name,
      );
      if (target === undefined) {
        return;
      }
      clearInterval(timer);
      target.click();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [name]);
  return <>{children}</>;
};
