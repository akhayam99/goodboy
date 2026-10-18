import { useShallow } from 'zustand/react/shallow';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import type { SessionDraftMount } from '../../../../store/slices/sessionDraft/startSessionFromDraft';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import { ProjectPicker } from '../../../../shared/components/ProjectPicker';
import { starredProjectsFirst } from '../../../../shared/utils/starredProjectsFirst';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly suggestedIds?: ReadonlyArray<ProjectId>;
  readonly launch?: SessionDraftMount | null;
  readonly isDisabled?: boolean;
};

export const KickoffProjects = ({
  workspaceId,
  suggestedIds,
  launch = null,
  isDisabled = false,
}: Props) => {
  const projects = useAppStore(
    useShallow((state) =>
      starredProjectsFirst({
        projects: state.projects.filter(
          (project) => project.workspaceId === workspaceId && project.disconnectedAt == null,
        ),
        inside: 'recency',
      }),
    ),
  );
  const projectIds = useAppStore((state) => selectSessionDraft({ state, workspaceId }).projectIds);
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  if (projects.length === 0) {
    return null;
  }
  const launchProject = launch === null ? null : (projectById(projects, launch.projectId) ?? null);
  return (
    <section aria-label="Folders" className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="text-label text-foreground">Folders</span>
        <span className="text-meta text-faint-foreground">Optional</span>
      </div>
      <ProjectPicker
        projects={projects}
        value={projectIds}
        isDisabled={isDisabled}
        emptyValueLabel="Add folder"
        {...(suggestedIds !== undefined && { suggestedIds })}
        onChange={(next) => patchSessionDraft({ workspaceId, patch: { projectIds: next } })}
      />
      {launch === null || launchProject === null ? null : (
        <p className="text-meta text-muted-foreground">{`In ${launchProject.name}, ${launch.reason}.`}</p>
      )}
    </section>
  );
};
