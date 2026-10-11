import type { Session } from '@goodboy/types';
import { WorkflowRunStartButton } from '../WorkflowRunStartButton';
import { sessionPlace, useAppStore } from '../../../../../store';
import type { RunPrimary } from '../../../../workflows/runPrimaryOf';
import type { RunView } from '../useRunView';
import { RaiseCapPrimary } from './RaiseCapPrimary';
import { RunPrimaryButton } from './RunPrimaryButton';
import { StartStepPrimary } from './StartStepPrimary';

type Props = {
  readonly session: Session;
  readonly view: RunView;
  readonly primary: RunPrimary;
};

export const RunPrimaryAction = ({ session, view, primary }: Props) => {
  const startWorkflowRun = useAppStore((state) => state.startWorkflowRun);
  const navigate = useAppStore((state) => state.navigate);
  switch (primary.kind) {
    case 'start-run':
      return (
        <WorkflowRunStartButton
          sessionId={session.id}
          runId={view.run.id}
          blockReason={view.blockReason}
          onStart={async () => {
            await startWorkflowRun(session.id, view.run.id);
            navigate({ to: sessionPlace({ sessionId: session.id, lens: 'workflows' }) });
          }}
        />
      );
    case 'start-step':
      return <StartStepPrimary session={session} view={view} label={primary.label} />;
    case 'raise-cap':
      return <RaiseCapPrimary session={session} view={view} />;
    case 'review-plan':
    case 'approve-plan':
    case 'answer':
    case 'resume':
    case 'continue':
    case 'retry':
    case 'decide-next':
    case 'restore':
      return (
        <RunPrimaryButton session={session} view={view} kind={primary.kind} label={primary.label} />
      );
    default: {
      const exhaustive: never = primary.kind;
      return exhaustive;
    }
  }
};
