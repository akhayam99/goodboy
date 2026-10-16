import { Button, EmptyState } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../shared/components/conceptIcons';
import { writeLastWorkflowMode } from './WorkflowBuilderView/lastWorkflowMode';
import { ORCHESTRATED_COPY } from '../orchestratedCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
};

export const OrchestrateStart = ({ sessionId, workspaceId }: Props) => {
  const onClick = () => {
    writeLastWorkflowMode({ workspaceId, mode: 'dynamic' });
    window.dispatchEvent(
      new CustomEvent('goodboy:open-workflow-builder', { detail: { sessionId } }),
    );
  };

  return (
    <EmptyState
      size="page"
      icon={CONCEPT_ICONS.orchestrator}
      title={ORCHESTRATED_COPY.emptyTitle}
      description={ORCHESTRATED_COPY.emptyDescription}
      action={
        <Button variant="primary" size="sm" onClick={onClick}>
          <CONCEPT_ICONS.orchestrator size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          {ORCHESTRATED_COPY.start}
        </Button>
      }
    />
  );
};
