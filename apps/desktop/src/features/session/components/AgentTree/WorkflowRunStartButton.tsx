import { TriangleAlert, Play } from 'lucide-react';
import { Button, ConfirmPopover, ICON_SIZE } from '@goodboy/ui';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import type { WorkflowBlockReason } from '../../../workflows/advanceGate';
import { useStartAnywayConfirm } from '../../../workflows/useStartAnywayConfirm';

import { useFollowToast } from '../../../../shared/hooks/useFollowToast';
import { markUserStart } from '../../../../shared/lib/userStarts';
import { useAppStore } from '../../../../store';
import { captureLocation } from '../../../../store/slices/navigation/captureLocation';
import { locationKey } from '../../../../store/slices/navigation/locationKey';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import type { Place } from '../../../../store/slices/navigation/types';

type Props = {
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
  readonly blockReason: WorkflowBlockReason | null;
  readonly onStart: () => void | Promise<void>;
  readonly variant?: 'primary' | 'secondary';
};

type AtPlaceParams = {
  readonly place: Place;
};

const isAtPlace = ({ place }: AtPlaceParams): boolean =>
  locationKey({ place: captureLocation({ state: useAppStore.getState() }).place }) ===
  locationKey({ place });

export const WorkflowRunStartButton = ({
  sessionId,
  runId,
  blockReason,
  onStart,
  variant = 'primary',
}: Props) => {
  const followRun = useFollowToast();
  const start = useStartAnywayConfirm({
    blockReason,
    title: 'Start this run anyway?',
    onStart: async () => {
      const place = sessionPlace({
        sessionId,
        lens: 'workflows',
        target: { kind: 'run', runId },
      });
      const historyBefore = useAppStore.getState().navigation;
      const wasThere = isAtPlace({ place });
      markUserStart({ key: runId });
      await onStart();
      const hasNavigated = useAppStore.getState().navigation !== historyBefore;
      if (isAtPlace({ place }) && (hasNavigated || !wasThere)) {
        return;
      }
      followRun({ title: 'Run started', target: { place }, startKey: runId });
    },
  });
  const isBlocked = blockReason != null;

  return (
    <ConfirmPopover
      role="alert"
      icon={<TriangleAlert size={ICON_SIZE.row} />}
      title={start.title}
      description={start.description}
      confirmLabel={start.confirmLabel}
      cancelLabel={start.cancelLabel}
      isBusy={start.isBusy}
      isOpen={start.isConfirming}
      onConfirm={start.onConfirm}
      onCancel={start.onCancel}
      trigger={() => (
        <Button size="sm" variant={variant} isBusy={start.isBusy} onClick={start.onTrigger}>
          {isBlocked ? (
            <TriangleAlert size={ICON_SIZE.control} aria-hidden />
          ) : (
            <Play size={ICON_SIZE.control} aria-hidden />
          )}
          Start run
        </Button>
      )}
    />
  );
};
