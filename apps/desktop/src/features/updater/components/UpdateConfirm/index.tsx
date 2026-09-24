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

export const runningAgentsCopy = ({ count }: { count: number }): string => {
  if (count === 0) {
    return 'Nothing is running.';
  }
  if (count === 1) {
    return 'Restarting stops 1 running agent.';
  }
  return `Restarting stops ${count} running agents.`;
};

export const UpdateConfirm = ({ trigger, onOpenChangelog, align = 'end' }: Props) => {
  const version = useAppStore((state) => state.updateVersion);
  const failure = useAppStore((state) => state.updateFailure);
  const installUpdate = useAppStore((state) => state.installUpdate);
  const focusChangelogRelease = useAppStore((state) => state.focusChangelogRelease);
  const runningCount = useRunningAgentCount();
  const target = version ?? 'The new version';
  const installFailed = failure?.phase === 'install';

  return (
    <ConfirmPopover
      trigger={trigger}
      align={align}
      width="w-96"
      role="primary"
      icon={<ArrowUpCircle size={ICON_SIZE.control} aria-hidden />}
      title={installFailed ? `Couldn't install ${target}` : `Goodboy ${target} is available`}
      description={installFailed ? failure.message : runningAgentsCopy({ count: runningCount })}
      confirmLabel={installFailed ? 'Retry' : 'Download and restart'}
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
        void installUpdate();
      }}
    />
  );
};
