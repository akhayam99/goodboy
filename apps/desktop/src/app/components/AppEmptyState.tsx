import { useState } from 'react';
import { Button, EmptyState, DogMascot } from '@goodboy/ui';
import { NewProjectForm } from '../../shared/components/NewProjectForm';

type Props = {
  readonly onAddWorkspace: () => void;
  readonly startOpen?: boolean;
};

export const NoWorkspaceScreen = ({ onAddWorkspace, startOpen = false }: Props) => {
  const [isStarting, setIsStarting] = useState(startOpen);

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

      {isStarting ? (
        <div className="relative flex w-full max-w-md flex-col gap-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <DogMascot size={56} className="text-primary" />
            <h2 className="text-title text-foreground">Start a new project</h2>
          </div>
          <NewProjectForm onCancel={() => setIsStarting(false)} />
        </div>
      ) : (
        <EmptyState
          illustration={<DogMascot size={96} className="text-primary" />}
          title="Welcome to Goodboy"
          description="Start a project from nothing, or open a folder you already have."
          action={
            <div className="flex items-center gap-2">
              <Button size="md" onClick={() => setIsStarting(true)}>
                Start a new project
              </Button>
              <Button size="md" variant="secondary" onClick={onAddWorkspace}>
                Open a folder
              </Button>
            </div>
          }
          size="xl"
          headingLevel={2}
          className="relative max-w-2xl"
        />
      )}
    </div>
  );
};
