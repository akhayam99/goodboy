import { Button, EmptyState } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../shared/components/conceptIcons';
import { ORCHESTRATED_COPY } from '../orchestratedCopy';
import { openOrchestrateForm } from '../openOrchestrateForm';

type Props = {
  readonly sessionId: SessionId;
};

export const OrchestrateStart = ({ sessionId }: Props) => (
  <EmptyState
    size="page"
    icon={CONCEPT_ICONS.orchestrator}
    title={ORCHESTRATED_COPY.emptyTitle}
    description={ORCHESTRATED_COPY.emptyDescription}
    action={
      <Button variant="primary" size="sm" onClick={() => openOrchestrateForm({ sessionId })}>
        <CONCEPT_ICONS.orchestrator size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        {ORCHESTRATED_COPY.start}
      </Button>
    }
  />
);
