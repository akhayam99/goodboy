import { useShallow } from 'zustand/react/shallow';
import { LensEmptyState } from '@goodboy/ui';
import type { Session, SessionId, SessionProjectMount } from '@goodboy/types';
import { useAppStore, useMountDiffStats } from '../../../../../../store';
import { PaneShell } from '../../../../../../shared/components/PaneShell';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import { MountProjectPopover } from './MountProjectPopover';
import { ProjectRow } from './ProjectRow';

const EMPTY_MOUNTS: ReadonlyArray<SessionProjectMount> = [];

type Props = {
  readonly session: Session;
};

export const ProjectsPane = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const mounts = useAppStore((state) => state.sessionProjectMounts[sessionId] ?? EMPTY_MOUNTS);
  const activeProjectId = useAppStore((state) => state.sessionActiveProject[sessionId] ?? null);
  const projects = useAppStore(
    useShallow((state) =>
      state.projects.filter((project) => project.workspaceId === session.workspaceId),
    ),
  );
  const diffStats = useMountDiffStats(sessionId);

  const activeMountedId =
    mounts.find((mount) => mount.projectId === activeProjectId)?.projectId ??
    mounts[0]?.projectId ??
    null;
  const mounted = projects.flatMap((project) => {
    const mount = mounts.find((candidate) => candidate.projectId === project.id);
    return mount == null ? [] : [{ project, mount }];
  });
  const unmounted = projects.filter((project) =>
    mounts.every((mount) => mount.projectId !== project.id),
  );

  return (
    <PaneShell
      title="Projects"
      description="Mounting a project checks it out into this session so agents can work on its code. Agents mount projects on their own when a task needs to write into one. Mounting manually pins the project up front."
    >
      {projects.length === 0 ? (
        <LensEmptyState
          icon={CONCEPT_ICONS.workspace}
          tone={CONCEPT_TONE.workspace}
          title="No projects in this workspace"
          description="Add a project to the workspace to mount it into sessions."
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {mounted.length === 0 ? (
            <p className="text-xs text-muted-foreground">No projects mounted yet</p>
          ) : (
            mounted.map(({ project, mount }) => (
              <ProjectRow
                key={project.id}
                sessionId={sessionId}
                project={project}
                mount={mount}
                isActive={project.id === activeMountedId}
                canSwitch={mounts.length > 1}
                diffStat={diffStats.get(mount.worktreePath) ?? null}
              />
            ))
          )}
          {unmounted.length > 0 ? (
            <MountProjectPopover sessionId={sessionId} projects={unmounted} />
          ) : null}
        </div>
      )}
    </PaneShell>
  );
};
