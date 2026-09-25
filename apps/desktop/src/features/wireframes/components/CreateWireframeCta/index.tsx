import { ActionTile, Button, cn } from '@goodboy/ui';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { wireframeCreationAdapter } from '../../wireframeCreationAdapter';

type CreateWireframeCtaVariant = 'compact' | 'tile';

const WIREFRAME_TILE_DESCRIPTION = 'Draw the screen or flow you describe.';

type Props = {
  readonly sessionId: SessionId;
  readonly workflowRunId?: WorkflowRunId | null;
  readonly variant?: CreateWireframeCtaVariant;
  readonly className?: string;
  readonly title?: string;
};

export const CreateWireframeCta = ({
  sessionId,
  workflowRunId = null,
  variant = 'compact',
  className,
  title,
}: Props) => {
  const openArtifactCreation = useAppStore((state) => state.openArtifactCreation);
  const open = () => openArtifactCreation({ sessionId, kind: 'wireframe', workflowRunId });

  if (variant === 'tile') {
    return (
      <ActionTile
        icon={
          <CONCEPT_ICONS.wireframe
            size={ICON_SIZE.hero}
            aria-hidden
            className="text-muted-foreground"
          />
        }
        title="Create wireframe"
        description={WIREFRAME_TILE_DESCRIPTION}
        testId="create-wireframe-cta"
        className={className}
        onClick={open}
      />
    );
  }

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
