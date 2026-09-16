import { LayoutTemplate } from 'lucide-react';
import { Button, cn } from '@goodboy/ui';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { wireframeCreationAdapter } from '../../wireframeCreationAdapter';

type Props = {
  readonly sessionId: SessionId;
  readonly workflowRunId?: WorkflowRunId | null;
  readonly className?: string;
  readonly title?: string;
};

export const CreateWireframeCta = ({
  sessionId,
  workflowRunId = null,
  className,
  title,
}: Props) => {
  const openArtifactCreation = useAppStore((state) => state.openArtifactCreation);

  return (
    <Button
      variant="secondary"
      size="sm"
      className={cn('min-w-0', className)}
      data-testid="create-wireframe-cta"
      title={title ?? wireframeCreationAdapter.ctaTitle}
      onClick={() => openArtifactCreation({ sessionId, kind: 'wireframe', workflowRunId })}
    >
      <LayoutTemplate size={ICON_SIZE.row} aria-hidden />
      Create wireframe
    </Button>
  );
};
