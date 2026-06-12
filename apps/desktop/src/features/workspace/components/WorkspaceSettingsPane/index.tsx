import { useEffect } from 'react';
import { Settings2, X } from 'lucide-react';
import { Divider, cn } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { WorkspaceScopePanel } from '../../../settings/components/SettingsStudio/WorkspaceScopePanel';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly initialSection?: string;
  readonly onClose: () => void;
};

export const WorkspaceSettingsPane = ({
  workspaceId,
  workspaceName,
  initialSection,
  onClose,
}: Props) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [onClose]);

  return (
    <div className="flex h-full w-full flex-col bg-background motion-safe:animate-studio-in">
      <header className="flex shrink-0 items-center gap-2.5 px-4 py-3">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
          <Settings2 size={14} className="text-primary" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 className="text-sm font-semibold text-foreground">Workspace settings</h2>
          <span className="truncate text-2xs text-muted-foreground">{workspaceName}</span>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          aria-label="close workspace settings"
          className={cn(
            'flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors',
            'hover:bg-muted/50 hover:text-foreground',
          )}
        >
          <X size={15} aria-hidden />
        </button>
      </header>
      <Divider />
      <div className="min-h-0 flex-1">
        <WorkspaceScopePanel
          workspaceId={workspaceId}
          initialSection={initialSection}
          requestClose={onClose}
        />
      </div>
    </div>
  );
};
