import { Check, FolderGit2, RefreshCw } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { Workspace, WorkspaceKind } from '@goodboy/types';

type Props = {
  readonly workspace: Workspace | null;
};

const WORKSPACE_KIND_LABELS: Record<WorkspaceKind, string> = {
  repo: 'Repository',
  composite: 'Composite',
  simple: 'Simple',
};

export const WorkspaceStep = ({ workspace }: Props) => {
  const workspaceKind = workspace?.kind ?? 'repo';

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40 text-primary">
        <FolderGit2 size={26} aria-hidden />
      </span>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {workspace === null ? 'Add workspace' : 'Workspace connected'}
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {workspace === null
            ? 'Add a repository-backed project, or create a simple project for agents, workflows, and shared context.'
            : 'This workspace will be used for your Goodboy setup.'}
        </p>
      </div>

      {workspace === null ? (
        <Button
          variant="secondary"
          onClick={() => window.dispatchEvent(new CustomEvent('goodboy:add-workspace'))}
        >
          <FolderGit2 size={14} aria-hidden /> Add workspace
        </Button>
      ) : (
        <div className="flex w-full max-w-md flex-col items-center gap-3">
          <div className="flex w-full items-center gap-3 rounded-lg border border-success/40 bg-success/10 px-3 py-2.5 text-left">
            <Check size={18} className="shrink-0 text-success" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {workspace.name}
                </span>
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {WORKSPACE_KIND_LABELS[workspaceKind]}
                </span>
              </span>
              <span className="block truncate font-mono text-xs text-muted-foreground/80">
                {workspace.rootPath}
              </span>
            </span>
          </div>
          <Button
            variant="secondary"
            onClick={() => window.dispatchEvent(new CustomEvent('goodboy:add-workspace'))}
          >
            <RefreshCw size={14} aria-hidden /> Change workspace
          </Button>
        </div>
      )}
    </div>
  );
};
