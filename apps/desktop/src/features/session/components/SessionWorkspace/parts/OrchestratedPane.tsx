import { Plus } from 'lucide-react';
import type { Session } from '@goodboy/types';
import { Button, PaneShell } from '@goodboy/ui';
import { useAttachedWorkflowRuns } from '../../../../workflows/useAttachedWorkflowRuns';
import { OrchestrateStart } from '../../../../workflows/components/OrchestrateStart';
import { ORCHESTRATED_COPY } from '../../../../workflows/orchestratedCopy';
import { openOrchestrateForm } from '../../../../workflows/openOrchestrateForm';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
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
    <PaneShell
      page="orchestrated"
      title={NAMES.orchestrated}
      actions={
        hasRuns ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openOrchestrateForm({ sessionId: session.id })}
          >
            <Plus size={ICON_SIZE.row} aria-hidden className="shrink-0" />
            {ORCHESTRATED_COPY.start}
          </Button>
        ) : null
      }
    >
      {hasRuns ? (
        <RunsGrid session={session} attachedRuns={orchestratedRuns} label={NAMES.orchestrated} />
      ) : (
        <OrchestrateStart sessionId={session.id} />
      )}
    </PaneShell>
  );
};
