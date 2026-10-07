import { Plus } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { Button, EmptyState } from '@goodboy/ui';

type Props = {
  readonly sessionId: SessionId;
  readonly layout?: 'page' | 'section';
};

export const WorkflowStartButton = ({ sessionId, layout = 'page' }: Props) => {
  const isPage = layout === 'page';
  const onClick = () => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-workflow-builder', { detail: { sessionId } }),
    );
  };

  return (
    <EmptyState
      size={layout}
      icon={CONCEPT_ICONS.workflows}
      title="No runs yet"
      description="A run is a workflow working on this session."
      action={
        <Button
          variant={isPage ? 'primary' : 'ghost'}
          size={isPage ? 'sm' : 'xs'}
          onClick={onClick}
        >
          <Plus size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          Start a run
        </Button>
      }
    />
  );
};
