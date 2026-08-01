import { Plus } from 'lucide-react';
import { EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';

type Props = {
  onAddWorkspace: () => void;
};

export const NoWorkspaceEmpty = ({ onAddWorkspace }: Props) => {
  return (
    <EmptyState
      icon={CONCEPT_ICONS.workspace}
      tone="info"
      title="No workspace yet"
      description="Point at a local git repo. Each session opens its own worktree off it."
      className="h-full justify-center px-6 py-10"
      action={
        <button
          type="button"
          onClick={onAddWorkspace}
          className="inline-flex items-center gap-1.5 rounded-md bg-info/15 px-3 py-1.5 text-xs font-medium text-info transition-colors hover:bg-info/25"
        >
          <Plus size={12} aria-hidden />
          <span>Add workspace</span>
        </button>
      }
    />
  );
};
