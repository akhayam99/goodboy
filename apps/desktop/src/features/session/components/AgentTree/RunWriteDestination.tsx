import { useShallow } from 'zustand/react/shallow';
import { Chip, ICON_SIZE } from '@goodboy/ui';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import {
  selectActiveMountId,
  selectWritableMounts,
} from '../../../../store/slices/project-mounts/selectors';
import { selectCurrentStepPin } from '../../../../store/slices/workflows/runMount/selectCurrentStepPin';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { WriteDestinationControl } from '../../../chat/components/WriteDestinationControl';
import { RUN_STEP_PIN_COPY } from '../../../workflows/runStepPinCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly workflowRunId?: WorkflowRunId;
};

const WorktreeIcon = CONCEPT_ICONS.worktree;

export const RunWriteDestination = ({ sessionId, workflowRunId }: Props) => {
  const writableMountCount = useAppStore(
    (state) => selectWritableMounts({ state, sessionId }).length,
  );
  const pin = useAppStore(
    useShallow((state) =>
      workflowRunId === undefined
        ? null
        : selectCurrentStepPin({
            state,
            sessionId,
            workflowRunId,
            activeMountId: selectActiveMountId({ state, sessionId }),
          }),
    ),
  );
  if (pin !== null && (!pin.isAvailable || pin.isOffActive)) {
    return (
      <span className="inline-flex min-w-0 max-w-96 items-center">
        <Chip
          kind="state"
          tone={pin.isAvailable ? 'neutral' : 'warning'}
          bordered={false}
          icon={<WorktreeIcon size={ICON_SIZE.row} aria-hidden />}
          label={
            <span className="flex min-w-0 items-baseline gap-1">
              <span className="shrink-0 text-muted-foreground">Writes to</span>
              <span className="min-w-0 truncate text-foreground">{pin.label}</span>
            </span>
          }
          title={RUN_STEP_PIN_COPY.title({ label: pin.label, isAvailable: pin.isAvailable })}
          className="min-w-0 max-w-full"
        />
      </span>
    );
  }
  if (writableMountCount <= 1) {
    return null;
  }
  return (
    <WriteDestinationControl
      sessionId={sessionId}
      agentId={null}
      fallback="automatic"
      verb="Writes to"
    />
  );
};
