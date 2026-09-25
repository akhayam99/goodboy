import { Button, cn } from '@goodboy/ui';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
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
  const open = () => openArtifactCreation({ sessionId, kind: 'wireframe', workflowRunId });

  return (
    <Button
      variant="secondary"
      size="sm"
      className={cn('min-w-0', className)}
      data-testid="create-wireframe-cta"
      title={title ?? wireframeCreationAdapter.ctaTitle}
      onClick={open}
    >
      <CONCEPT_ICONS.wireframe size={ICON_SIZE.row} aria-hidden />
      Create wireframe
    </Button>
  );
};
