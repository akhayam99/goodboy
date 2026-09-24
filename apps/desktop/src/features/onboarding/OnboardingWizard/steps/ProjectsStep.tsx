import { FolderGit2 } from 'lucide-react';
import type { Workspace } from '@goodboy/types';
import { ProjectLinkList } from '../../../../shared/components/ProjectLinkList';
import type { ProjectAttachConflict } from '../../../../store/slices/projects/addProject';

type Props = {
  readonly workspace: Workspace;
  readonly initialConflicts?: ReadonlyArray<ProjectAttachConflict>;
};

export const ProjectsStep = ({ workspace, initialConflicts }: Props) => (
  <div className="flex flex-col items-center gap-6 text-center">
    <span className="flex size-14 items-center justify-center rounded-lg border border-border-soft bg-subtle text-primary">
      <FolderGit2 size={26} aria-hidden />
    </span>

    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">Link your projects</h2>
      <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
        Add the repositories {workspace.name} works on.
      </p>
    </div>

    <div className="w-full text-left">
      <ProjectLinkList workspaceId={workspace.id} initialConflicts={initialConflicts} />
    </div>
  </div>
);
