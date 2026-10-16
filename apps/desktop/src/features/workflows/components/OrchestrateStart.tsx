import { Button, EmptyState } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../shared/components/conceptIcons';
import { ORCHESTRATED_COPY } from '../orchestratedCopy';

type Props = {
  readonly sessionId: SessionId;
};

export const OrchestrateStart = ({ sessionId }: Props) => {
  const onClick = () => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-workflow-builder', {
        detail: { sessionId, form: 'orchestrate' },
      }),
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
