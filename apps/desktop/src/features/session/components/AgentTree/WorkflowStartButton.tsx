import { Plus } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { LensEmptyState } from '@goodboy/ui';

type Props = {
  readonly sessionId: SessionId;
};

export const WorkflowStartButton = ({ sessionId }: Props) => {
  const onClick = () => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-workflow-builder', { detail: { sessionId } }),
    );
  };

  return (
    <LensEmptyState
      tone={CONCEPT_TONE.workflows}
      icon={CONCEPT_ICONS.workflows}
      title="No runs yet"
      description="Start a run from a workflow to work through structured steps."
      action={
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-2 rounded-lg bg-subtle px-3 py-2 text-label font-medium text-foreground ring-1 ring-border-soft transition-colors hover:bg-hover"
        >
          <Plus size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          Start a run
        </button>
      }
    />
  );
};
