import { useCallback, useEffect, useState } from 'react';
import { startPoll } from '../../../../../shared/lib/usePoll/startPoll';
import { bridgePhones, bridgeStatus, type BridgeStatus, type PairedPhone } from '../../../bridge';

const LINK_POLL_MS = 5_000;

export const useBridgeLink = () => {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [phones, setPhones] = useState<ReadonlyArray<PairedPhone>>([]);

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const [nextStatus, nextPhones] = await Promise.all([bridgeStatus(), bridgePhones()]);
      setStatus(nextStatus);
      setPhones(Array.isArray(nextPhones) ? nextPhones : []);
      return true;
    } catch {
      setStatus(null);
      setPhones([]);
      return false;
    }
  }, []);

  useEffect(
    () =>
      startPoll({
        run: () => {
          void refresh();
        },
        everyMs: LINK_POLL_MS,
        gate: 'visible',
        isImmediate: true,
      }),
    [refresh],
  );

  return { status, phones, refresh };
};
