import type { UpdateFailure, UpdaterState } from '../../store/slices/updater/state';

export type UpdateCardState = 'available' | 'ready' | 'running' | 'failed' | 'queued';

type Params = {
  readonly status: UpdaterState['updaterStatus'];
  readonly failure: UpdateFailure | null;
  readonly isQueued: boolean;
  readonly runningCount: number;
};

const PENDING_STATUSES: ReadonlySet<UpdaterState['updaterStatus']> = new Set([
  'available',
  'downloading-bg',
  'ready',
  'downloading',
]);

const READY_STATUSES: ReadonlySet<UpdaterState['updaterStatus']> = new Set([
  'ready',
  'downloading',
]);

export const updateCardStateOf = ({
  status,
  failure,
  isQueued,
  runningCount,
}: Params): UpdateCardState | null => {
  if (isQueued) {
    return 'queued';
  }
  if (!PENDING_STATUSES.has(status)) {
    return null;
  }
  const isWorking = status === 'downloading' || status === 'downloading-bg';
  if (!isWorking && failure !== null && failure.phase !== 'check') {
    return 'failed';
  }
  if (!READY_STATUSES.has(status)) {
    return 'available';
  }
  if (status === 'ready' && runningCount > 0) {
    return 'running';
  }
  return 'ready';
};
