import { Plus, Workflow as WorkflowIcon } from 'lucide-react';
import { EmptyState } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';

export function WorkflowStartButton({
  sessionId,
  variant,
}: {
  sessionId: SessionId;
  variant: 'empty' | 'attach';
}) {
  const onClick = () => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-workflow-builder', { detail: { sessionId } }),
    );
  };

  if (variant === 'empty') {
    return (
      <EmptyState
        bordered
        tone="accent"
        icon={WorkflowIcon}
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
  }

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-2 rounded border border-dashed border-border-soft px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
      >
        <Plus size={13} aria-hidden className="shrink-0" />
        <span className="min-w-0 truncate">Attach another workflow</span>
      </button>
    </div>
  );
}
