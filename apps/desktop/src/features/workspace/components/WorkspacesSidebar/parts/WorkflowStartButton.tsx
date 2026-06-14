import { Plus } from 'lucide-react';
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
  return (
    <div className={variant === 'empty' ? '' : 'mt-1.5'}>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-2 rounded border border-dashed border-border-soft px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
      >
        <Plus size={13} aria-hidden className="shrink-0" />
        <span className="min-w-0 truncate">
          {variant === 'empty' ? 'Start a workflow' : 'Attach another workflow'}
        </span>
      </button>
    </div>
  );
}
