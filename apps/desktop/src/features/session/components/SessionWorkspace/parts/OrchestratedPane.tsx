import type { Session } from '@goodboy/types';
import { PaneShell } from '@goodboy/ui';
import { useAttachedWorkflowRuns } from '../../../../workflows/useAttachedWorkflowRuns';
import { OrchestrateStart } from '../../../../workflows/components/OrchestrateStart';
import { NAMES } from '../../../../../shared/names';
import { RunsGrid } from './RunsGrid';

type Props = {
  readonly session: Session;
};

export const OrchestratedPane = ({ session }: Props) => {
  const orchestratedRuns = useAttachedWorkflowRuns({ session }).filter(
    ({ run }) => run.executionMode === 'dynamic',
  );
  const hasRuns = orchestratedRuns.length > 0;

  return (
    <PaneShell title={NAMES.orchestrated} meta={hasRuns ? orchestratedRuns.length : undefined}>
      {hasRuns ? (
        <RunsGrid session={session} attachedRuns={orchestratedRuns} label={NAMES.orchestrated} />
      ) : (
        <OrchestrateStart sessionId={session.id} />
      )}
    </PaneShell>
  );
};
