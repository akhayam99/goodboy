import { useAppStore } from '../../../store';
import { CHECK_STATE } from '../../../store/slices/notifications/errorRecovery';

type Params = {
  readonly title: string;
  readonly error: unknown;
};

export const reportChipError = ({ title, error }: Params): void => {
  void useAppStore
    .getState()
    .reportError({ recovery: CHECK_STATE, title, error, coalesceKey: 'call-chip' });
};
