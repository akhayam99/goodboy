import type { SessionId, WorkflowRunId } from '@goodboy/types';
import type { WorkflowBlockReason } from '../../../workflows/advanceGate';
import { StartAnywayButton } from '../../../workflows/components/StartAnywayButton';

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

  return (
    <StartAnywayButton
      label="Start run"
      variant={variant}
      title="Start this run anyway?"
      blockReason={blockReason}
      onStart={async () => {
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
      }}
    />
  );
};
