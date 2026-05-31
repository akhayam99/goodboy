import { cn, Divider } from '@goodboy/ui';
import { Layers, X } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { WorkflowsPanel } from '../WorkflowsPanel';
import { useStudioOverlay } from '../../../../shared/hooks/useStudioOverlay';

interface Props {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly onClose: () => void;
}

export function WorkflowStudio({ workspaceId, workspaceName, onClose }: Props) {
  const { closing, requestClose } = useStudioOverlay(onClose);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col bg-background',
        closing ? 'motion-safe:animate-studio-out' : 'motion-safe:animate-studio-in',
      )}
    >
      <header className="flex shrink-0 items-center gap-3 px-6 py-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
          <Layers size={16} className="text-primary" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-foreground">Workflow Studio</h1>
            <span className="rounded bg-warning/20 px-1 py-px text-[8px] font-semibold uppercase leading-none tracking-wide text-warning">
              beta
            </span>
          </div>
          <span className="truncate text-2xs text-muted-foreground">{workspaceName}</span>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={requestClose}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5',
            'text-xs font-semibold text-danger transition-colors',
            'hover:border-danger/60 hover:bg-danger/15',
          )}
          aria-label="close workflow studio"
        >
          <X size={13} aria-hidden /> Done
        </button>
      </header>
      <Divider />

      <div className="min-h-0 flex-1">
        <WorkflowsPanel workspaceId={workspaceId} />
      </div>
    </div>
  );
}
