import type { ReactNode } from 'react';
import { ArrowUpCircle } from 'lucide-react';
import { ConfirmPopover, type ConfirmPopoverTriggerParams } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { useRunningAgentCount } from '../../hooks/useRunningAgentCount';

type Props = {
  readonly trigger: (params: ConfirmPopoverTriggerParams) => ReactNode;
  readonly onOpenChangelog?: () => void;
  readonly align?: 'start' | 'end';
};

export const activeWorkCopy = ({ count }: { count: number }): string => {
  if (count === 0) {
    return 'Nothing is active.';
  }
  if (count === 1) {
    return 'The active work picks up where it stopped after the restart.';
  }
  return `The ${count} pieces of active work pick up where they stopped after the restart.`;
};

export const UpdateConfirm = ({ trigger, onOpenChangelog, align = 'end' }: Props) => {
  const version = useAppStore((state) => state.updateVersion);
  const status = useAppStore((state) => state.updaterStatus);
  const failure = useAppStore((state) => state.updateFailure);
  const applyUpdate = useAppStore((state) => state.applyUpdate);
  const focusChangelogRelease = useAppStore((state) => state.focusChangelogRelease);
  const runningCount = useRunningAgentCount();
  const target = version ?? 'The new version';
  const installFailed = failure?.phase === 'install';
  const isReady = status === 'ready';

  return (
    <ConfirmPopover
      trigger={trigger}
      align={align}
      width="w-96"
      role="primary"
      icon={<ArrowUpCircle size={ICON_SIZE.control} aria-hidden />}
      title={
        installFailed
          ? `Couldn't install ${target}`
          : `Goodboy ${target} is ${isReady ? 'ready' : 'available'}`
      }
      description={installFailed ? failure.message : activeWorkCopy({ count: runningCount })}
      confirmLabel={installFailed ? 'Retry' : isReady ? 'Restart now' : 'Download and restart'}
      cancelLabel="Not now"
      altAction={
        onOpenChangelog === undefined
          ? undefined
          : {
              label: "What's new",
              onClick: () => {
                focusChangelogRelease({ version });
                onOpenChangelog();
              },
            }
      }
      onConfirm={() => {
        void applyUpdate();
      }}
    />
  );
};
