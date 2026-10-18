import { useEffect, useState } from 'react';
import { homeFolder } from '../../../../../shared/lib/homeFolder';

export const useHomeFolder = (): string | null => {
  const [home, setHome] = useState<string | null>(null);

  useEffect(() => {
    let isLive = true;
    void homeFolder().then((found) => {
      if (isLive) {
        setHome(found);
      }
    });
    return () => {
      isLive = false;
    };
  }, []);

  return home;
};
