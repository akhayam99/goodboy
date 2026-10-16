import { HeaderActions } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { RunOverflowMenu } from '../RunOverflowMenu';
import type { ActionViewing, WorkflowRunActionTarget } from '../../../../actions/types';
import type { RunView } from '../useRunView';
import { WorkflowCloseButton } from '../../../../workflows/components/WorkflowCloseButton';
import { RunPrimaryAction } from './RunPrimaryAction';

const OMITTED_FROM_OVERFLOW: ReadonlyArray<string> = [
  'workflowRun.open',
  'workflowRun.answer',
  'workflowRun.start',
  'workflowRun.continue',
  'workflowRun.restartStep',
  'workflowRun.nextStep',
  'workflowRun.restore',
  'workflowRun.close',
  'workflowRun.autonomy',
];

type Props = {
  readonly session: Session;
  readonly view: RunView;
  readonly target: WorkflowRunActionTarget;
  readonly viewing: ActionViewing;
};

export const RunHeaderActions = ({ session, view, target, viewing }: Props) => {
  const closeWorkflowRun = useAppStore((state) => state.closeWorkflowRun);
  const { run, primary, name } = view;

  return (
    <HeaderActions
      secondary={
        view.isClosable ? (
          <WorkflowCloseButton onConfirm={() => void closeWorkflowRun(session.id, run.id)} />
        ) : null
      }
      primary={
        primary === null ? null : (
          <RunPrimaryAction session={session} view={view} primary={primary} />
        )
      }
      overflow={
        <RunOverflowMenu
          target={target}
          viewing={viewing}
          name={name}
          omit={OMITTED_FROM_OVERFLOW}
        />
      }
    />
  );
};
