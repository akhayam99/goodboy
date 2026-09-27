import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { starredProjectsFirst } from '../../../../shared/utils/starredProjectsFirst';
import { MountProjectList } from '../SessionOverviewPane/ProjectMountRows/MountProjectList';
import { SetupStepActions } from './SetupStepActions';

type Props = {
  readonly session: Session;
};

const openWorkspaceProjects = () => {
  window.dispatchEvent(
    new CustomEvent('goodboy:open-settings', {
      detail: { scope: 'workspace', section: 'projects' },
    }),
  );
};

export const ProjectStep = ({ session }: Props) => {
  const sessionId = session.id;
  const skipSessionSetupStep = useAppStore((state) => state.skipSessionSetupStep);
  const closeSessionSetupStep = useAppStore((state) => state.closeSessionSetupStep);
  const available = useAppStore(
    useShallow((state) => {
      const mounts = state.sessionProjectMounts[sessionId] ?? EMPTY_ARRAY;
      return state.projects.filter(
        (project) =>
          project.workspaceId === session.workspaceId &&
          mounts.every((mount) => mount.projectId !== project.id),
      );
    }),
  );
  const ordered = useMemo(() => starredProjectsFirst({ projects: available }), [available]);
  const skip = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => skipSessionSetupStep({ sessionId, step: 'project' })}
    >
      Skip
    </Button>
  );

  if (ordered.length === 0) {
    return (
      <SetupStepActions note="This workspace has no project to add yet.">
        {skip}
        <Button variant="secondary" size="sm" onClick={openWorkspaceProjects}>
          Add workspace project
        </Button>
      </SetupStepActions>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg bg-background py-1 ring-1 ring-inset ring-border-soft">
        <MountProjectList
          sessionId={sessionId}
          projects={ordered}
          onDone={() => closeSessionSetupStep({ sessionId })}
        />
      </div>
      <SetupStepActions note="Skip it and turns run in the session folder.">
        {skip}
      </SetupStepActions>
    </div>
  );
};
