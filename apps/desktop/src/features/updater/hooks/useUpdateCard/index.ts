import type { ButtonVariant } from '@goodboy/ui';
import { NAMES } from '../../../../shared/names';
import { useAppStore } from '../../../../store';
import { updateCardCopy, type UpdateCardCopy } from '../../updateCardCopy';
import type { UpdateCardState } from '../../updateCardState';
import { useUpdateCardState } from '../useUpdateCardState';

type UpdateVerbId =
  | 'later'
  | 'whats-new'
  | 'update-now'
  | 'restart-now'
  | 'restart-when-idle'
  | 'cancel-restart'
  | 'retry';

export type UpdateVerb = {
  readonly id: UpdateVerbId;
  readonly label: string;
  readonly variant: ButtonVariant;
  readonly isBusy: boolean;
  readonly busyLabel?: string;
  readonly run: () => void;
};

type Params = {
  readonly onLater?: () => void;
  readonly onOpenChangelog?: () => void;
};

export type UpdateCard = {
  readonly state: UpdateCardState | null;
  readonly version: string | null;
  readonly runningCount: number;
  readonly copy: UpdateCardCopy | null;
  readonly verbs: ReadonlyArray<UpdateVerb>;
};

type VerbParams = {
  readonly id: UpdateVerbId;
  readonly label: string;
  readonly variant: ButtonVariant;
  readonly run: () => void;
  readonly busyLabel?: string;
  readonly isBusy?: boolean;
};

type RestartParams = {
  readonly variant: ButtonVariant;
};

const verbOf = ({ id, label, variant, run, busyLabel, isBusy = false }: VerbParams): UpdateVerb =>
  busyLabel === undefined
    ? { id, label, variant, run, isBusy }
    : { id, label, variant, run, isBusy, busyLabel };

export const useUpdateCard = ({ onLater, onOpenChangelog }: Params = {}): UpdateCard => {
  const status = useAppStore((store) => store.updaterStatus);
  const failure = useAppStore((store) => store.updateFailure);
  const isQueued = useAppStore((store) => store.updateQueuedUntilIdle);
  const applyUpdate = useAppStore((store) => store.applyUpdate);
  const downloadUpdate = useAppStore((store) => store.downloadUpdate);
  const setUpdateQueuedUntilIdle = useAppStore((store) => store.setUpdateQueuedUntilIdle);
  const focusChangelogRelease = useAppStore((store) => store.focusChangelogRelease);
  const { state, version, runningCount } = useUpdateCardState();

  if (state === null) {
    return { state, version, runningCount, copy: null, verbs: [] };
  }

  const later =
    onLater === undefined
      ? []
      : [verbOf({ id: 'later', label: 'Later', variant: 'quiet', run: onLater })];
  const whatsNew =
    onOpenChangelog === undefined
      ? []
      : [
          verbOf({
            id: 'whats-new',
            label: NAMES.whatsNew,
            variant: 'ghost',
            run: () => {
              focusChangelogRelease({ version });
              onOpenChangelog();
            },
          }),
        ];
  const restartNow = ({ variant }: RestartParams): UpdateVerb =>
    verbOf({
      id: 'restart-now',
      label: 'Restart now',
      variant,
      isBusy: status === 'downloading',
      busyLabel: 'Restarting',
      run: () => {
        if (isQueued) {
          setUpdateQueuedUntilIdle({ queued: false });
        }
        void applyUpdate();
      },
    });

  const verbsByState: Record<UpdateCardState, ReadonlyArray<UpdateVerb>> = {
    available: [
      ...later,
      ...whatsNew,
      verbOf({
        id: 'update-now',
        label: 'Update now',
        variant: 'primary',
        isBusy: status === 'downloading-bg' || status === 'downloading',
        busyLabel: 'Downloading',
        run: () => {
          void downloadUpdate();
        },
      }),
    ],
    ready: [...later, ...whatsNew, restartNow({ variant: 'primary' })],
    running: [
      ...later,
      restartNow({ variant: 'secondary' }),
      verbOf({
        id: 'restart-when-idle',
        label: 'Restart when they finish',
        variant: 'primary',
        run: () => setUpdateQueuedUntilIdle({ queued: true }),
      }),
    ],
    failed: [
      ...later,
      verbOf({
        id: 'retry',
        label: 'Retry',
        variant: 'primary',
        run: () => {
          if (failure?.phase === 'download') {
            void downloadUpdate();
            return;
          }
          void applyUpdate();
        },
      }),
    ],
    queued: [
      ...later,
      verbOf({
        id: 'cancel-restart',
        label: 'Cancel restart',
        variant: 'secondary',
        run: () => setUpdateQueuedUntilIdle({ queued: false }),
      }),
      restartNow({ variant: 'primary' }),
    ],
  };

  return {
    state,
    version,
    runningCount,
    copy: updateCardCopy({ state, version, runningCount, failure }),
    verbs: verbsByState[state],
  };
};
