import { Plus } from 'lucide-react';
import { EmptyState } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';

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
    <EmptyState
      bordered
      tone="accent"
      icon={CONCEPT_ICONS.workflows}
      title="No workflows yet"
      description="Attach a workflow to run structured multi-step tasks for this session."
      action={
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground/[0.04] px-3 py-1.5 text-xs font-medium text-foreground ring-1 ring-border-soft transition-colors hover:bg-foreground/[0.08]"
        >
          <Plus size={13} aria-hidden className="shrink-0" />
          Start a workflow
        </button>
      }
    />
  );
};
