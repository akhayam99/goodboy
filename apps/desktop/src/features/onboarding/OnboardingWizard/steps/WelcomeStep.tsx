import { FolderGit2, Plug } from 'lucide-react';
import { DogMascot } from '../../../../shared/components/DogMascot';
import { SetupRow } from './SetupRow';

export const WelcomeStep = () => {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="relative">
        <div className="absolute -inset-6 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40 shadow-lg backdrop-blur-sm">
          <DogMascot size={56} className="text-foreground" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome to Goodboy
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Connect a provider and a workspace to run agents.
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-2">
        <SetupRow
          icon={<Plug size={15} className="text-info" aria-hidden />}
          title="Connect a provider"
          detail="The CLI that runs your agents (claude, codex, and more)."
        />
        <SetupRow
          icon={<FolderGit2 size={15} className="text-primary" aria-hidden />}
          title="Connect a workspace"
          detail="A project space for sessions, agents, workflows, and shared context."
        />
      </div>
    </div>
  );
};
