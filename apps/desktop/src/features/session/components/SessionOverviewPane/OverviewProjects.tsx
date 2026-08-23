import { Eyebrow } from '@goodboy/ui';
import type { Session, SessionProjectMount } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { AddProjectChip } from '../ProjectSwitcher/AddProjectChip';

const EMPTY_MOUNTS: ReadonlyArray<SessionProjectMount> = [];

type Props = {
  readonly session: Session;
};

export const OverviewProjects = ({ session }: Props) => {
  const mounts = useAppStore((s) => s.sessionProjectMounts[session.id] ?? EMPTY_MOUNTS);
  const projects = useAppStore((s) => s.projects);
  const unmaterialized = projects.filter(
    (project) =>
      project.workspaceId === session.workspaceId &&
      !mounts.some((mount) => mount.projectId === project.id),
  );

  if (unmaterialized.length === 0) {
    return null;
  }

  return (
    <section aria-label="Projects" className="flex flex-col gap-2">
      <Eyebrow label="Projects" />
      <div className="flex items-center gap-2">
        <AddProjectChip sessionId={session.id} />
        <span className="text-xs text-muted-foreground">
          Mount a project so agents can work inside its repository.
        </span>
      </div>
    </section>
  );
};
