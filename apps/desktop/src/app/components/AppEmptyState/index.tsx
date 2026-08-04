import { EmptyState } from '@goodboy/ui';
import { DogMascot } from '../../../shared/components/DogMascot';

type Props = {
  readonly onAddWorkspace: () => void;
};

export const NoWorkspaceScreen = ({ onAddWorkspace }: Props) => {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden px-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, transparent 40%, var(--color-background) 100%)',
        }}
        aria-hidden
      />

      <EmptyState
        illustration={<DogMascot size={96} className="text-primary" />}
        title="Welcome to Goodboy"
        description="Point at a project folder to create your first workspace. With git already set up, every session spins up its own worktree and branch and your main checkout stays untouched. Without it, Goodboy shows you the commands to set git up."
        action={
          <button
            type="button"
            onClick={onAddWorkspace}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm motion-safe:transition-colors hover:bg-primary/90"
          >
            Add workspace
          </button>
        }
        size="xl"
        headingLevel={2}
        className="relative max-w-2xl"
      />
    </div>
  );
};
