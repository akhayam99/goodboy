import { useEffect } from 'react';

type Params = {
  readonly isReady: boolean;
  readonly run: () => boolean;
};

export const useSceneScript = ({ isReady, run }: Params): void => {
  useEffect(() => {
    if (!isReady) {
      return;
    }
    const interval = window.setInterval(() => {
      if (run()) {
        window.clearInterval(interval);
      }
    }, 120);
    return () => window.clearInterval(interval);
  }, [isReady, run]);
};
