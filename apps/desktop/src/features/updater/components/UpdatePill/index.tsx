import { useAppStore } from '../../../../store';
import { useRunningAgentCount } from '../../hooks/useRunningAgentCount';
import { useUpdateSweep } from '../../hooks/useUpdateSweep';
import { UpdateConfirm } from '../UpdateConfirm';
import { QueuedRestartPopover } from './QueuedRestartPopover';
import { UpdatePillVisual } from './UpdatePillVisual';

type Props = {
  readonly onOpenChangelog?: () => void;
};

export const UpdatePill = ({ onOpenChangelog }: Props) => {
  const status = useAppStore((state) => state.updaterStatus);
  const version = useAppStore((state) => state.updateVersion);
  const isQueued = useAppStore((state) => state.updateQueuedUntilIdle);
  const setUpdateQueuedUntilIdle = useAppStore((state) => state.setUpdateQueuedUntilIdle);
  const runningCount = useRunningAgentCount();
  const isReady = status === 'ready';
  const isAvailable = status === 'available';
  const isActive = isReady || isAvailable;
  const sweepKey = useUpdateSweep({ active: isActive && !isQueued });

  if (!isActive && !isQueued) {
    return null;
  }

  const visual = (
    <UpdatePillVisual
      isQueued={isQueued}
      isReady={isReady}
      version={version}
      agentCount={runningCount}
      sweepKey={sweepKey}
    />
  );

  if (isQueued) {
    return (
      <QueuedRestartPopover
        trigger={visual}
        agentCount={runningCount}
        onCancel={() => setUpdateQueuedUntilIdle({ queued: false })}
      />
    );
  }

  return (
    <UpdateConfirm
      onOpenChangelog={onOpenChangelog}
      trigger={({ arm }) => (
        <button type="button" onClick={arm} className="rounded-full">
          {visual}
        </button>
      )}
    />
  );
};
