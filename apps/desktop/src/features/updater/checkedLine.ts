import { formatSpan } from '../../shared/utils/time/formatSpan';
import type { UpdateFailure, UpdaterState } from '../../store/slices/updater/state';

type CheckedLineParams = {
  readonly status: UpdaterState['updaterStatus'];
  readonly failure: UpdateFailure | null;
  readonly checkedAt: string | null;
  readonly now: number;
};

export const checkedLine = ({ status, failure, checkedAt, now }: CheckedLineParams): string => {
  if (failure?.phase === 'check') {
    return `Couldn't check for updates: ${failure.message}`;
  }
  if (checkedAt === null) {
    return 'Not checked yet. Goodboy looks for a new version every hour.';
  }
  const checked = `Checked ${formatSpan({ from: checkedAt, to: now })} ago.`;
  if (status === 'uptodate') {
    return `${checked} You have the latest version.`;
  }
  return checked;
};
