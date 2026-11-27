import { useEffect } from 'react';
import { useAppStore } from '../../../../store';
import { startPoll } from '../../../../shared/lib/usePoll/startPoll';

const RETRY_MS = 5_000;

type Params = {
  readonly isOn: boolean;
};

export const useCompanionInitialRead = ({ isOn }: Params): void => {
  const isRead = useAppStore((state) => state.companionHint !== null);
  const readCompanionPhones = useAppStore((state) => state.readCompanionPhones);
  useEffect(() => {
    if (!isOn || isRead) {
      return;
    }
    return startPoll({
      run: () => {
        void readCompanionPhones();
      },
      everyMs: RETRY_MS,
      gate: 'visible',
      isImmediate: true,
    });
  }, [isOn, isRead, readCompanionPhones]);
};
