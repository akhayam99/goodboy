import { useShallow } from 'zustand/react/shallow';
import { LensEmptyState } from '@goodboy/ui';
import type { Session, SessionId, SessionProjectMount } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { PaneShell } from '../../../../../../shared/components/PaneShell';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
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

  const activeMountedId =
    mounts.find((mount) => mount.projectId === activeProjectId)?.projectId ??
    mounts[0]?.projectId ??
    null;
  const mountedIds = new Set(mounts.map((mount) => mount.projectId));
  const ordered = [...projects].sort(
    (a, b) => (mountedIds.has(a.id) ? 0 : 1) - (mountedIds.has(b.id) ? 0 : 1),
  );

  return (
    <PaneShell
      title="Projects"
      description="Mounting a project checks it out into this session so agents can work on its code."
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
          {ordered.map((project) => (
            <ProjectRow
              key={project.id}
              sessionId={sessionId}
              project={project}
              mount={mounts.find((mount) => mount.projectId === project.id) ?? null}
              isActive={project.id === activeMountedId}
              canSwitch={mounts.length > 1}
            />
          ))}
        </div>
      )}
    </PaneShell>
  );
};
