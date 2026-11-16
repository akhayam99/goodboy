import { useEffect, useState } from 'react';
import { bridgeStatus, type BridgeStatus } from '../../../companion/bridge';

const pairedCount = async (): Promise<number> => {
  try {
    const status: BridgeStatus | undefined = await bridgeStatus();
    return status?.enrolledCount ?? 0;
  } catch {
    return 0;
  }
};

export const useIsIphonePaired = (): boolean => {
  const [isPaired, setIsPaired] = useState(false);

  useEffect(() => {
    let isLive = true;
    void pairedCount().then((count) => {
      if (isLive) {
        setIsPaired(count > 0);
      }
    });
    return () => {
      isLive = false;
    };
  }, []);

  return isPaired;
};
