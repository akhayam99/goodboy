import { Button, EmptyState } from '@goodboy/ui';
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
        description="Start from a project folder, or create a workspace and add the projects it works on."
        action={
          <Button size="md" onClick={onAddWorkspace}>
            Add workspace
          </Button>
        }
        size="xl"
        headingLevel={2}
        className="relative max-w-2xl"
      />
    </div>
  );
};
