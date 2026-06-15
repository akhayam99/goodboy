import { FolderPlus, Plus } from 'lucide-react';

type Props = {
  onAddWorkspace: () => void;
};

export const NoWorkspaceEmpty = ({ onAddWorkspace }: Props) => {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="relative">
        <div className="absolute inset-0 animate-pulse rounded-full bg-info/10 blur-xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-info/10">
          <FolderPlus size={26} className="text-info" aria-hidden />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">No workspace yet</h3>
        <p className="max-w-[220px] text-2xs leading-relaxed text-muted-foreground">
          Point at a local git repo. Each session opens its own worktree off it.
        </p>
      </div>
      <button
        type="button"
        onClick={onAddWorkspace}
        className="inline-flex items-center gap-1.5 rounded-md bg-info/15 px-3 py-1.5 text-xs font-medium text-info transition-colors hover:bg-info/25"
      >
        <Plus size={12} aria-hidden />
        <span>Add workspace</span>
      </button>
    </div>
  );
};
