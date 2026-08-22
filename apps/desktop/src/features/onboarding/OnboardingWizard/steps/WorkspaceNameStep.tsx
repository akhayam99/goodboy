import { FolderGit2 } from 'lucide-react';
import { Input } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';

type Props = {
  readonly workspace: Workspace | null;
  readonly name: string;
  readonly onNameChange: (name: string) => void;
};

export const WorkspaceNameStep = ({ workspace, name, onNameChange }: Props) => (
  <div className="flex flex-col items-center gap-6 text-center">
    <span className="flex size-14 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40 text-primary">
      <FolderGit2 size={26} aria-hidden />
    </span>

    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">
        {workspace === null ? 'Name your workspace' : 'Your workspace'}
      </h2>
      <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
        A workspace groups the projects, sessions, and connections of one product or team. You link
        its repositories and folders next.
      </p>
    </div>

    <div className="flex w-full max-w-sm flex-col gap-1.5 text-left">
      <label htmlFor="onboarding-workspace-name" className="text-xs font-medium text-foreground">
        Workspace name
      </label>
      <Input
        id="onboarding-workspace-name"
        value={name}
        autoFocus
        placeholder="Serenis"
        onChange={(event) => onNameChange(event.target.value)}
      />
    </div>
  </div>
);
