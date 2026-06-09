import { Check, FolderGit2 } from 'lucide-react';
import { Button } from '@goodboy/ui';

export function WorkspaceStep({ hasWorkspace }: { hasWorkspace: boolean }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40 text-primary">
        <FolderGit2 size={26} aria-hidden />
      </span>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Connect a workspace
        </h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          Point at a git repo to create your first workspace. Every session gets its own worktree
          and branch, so your checkout stays clean.
        </p>
      </div>

      {hasWorkspace ? (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
          <Check size={14} aria-hidden /> Workspace connected
        </span>
      ) : (
        <Button
          variant="secondary"
          onClick={() => window.dispatchEvent(new CustomEvent('goodboy:add-workspace'))}
        >
          <FolderGit2 size={14} aria-hidden /> Add workspace
        </Button>
      )}
    </div>
  );
}
