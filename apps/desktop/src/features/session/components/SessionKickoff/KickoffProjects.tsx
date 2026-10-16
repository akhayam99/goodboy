import { useShallow } from 'zustand/react/shallow';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { ProjectPicker } from '../../../../shared/components/ProjectPicker';
import { starredProjectsFirst } from '../../../../shared/utils/starredProjectsFirst';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly suggestedIds?: ReadonlyArray<ProjectId>;
  readonly reason?: string | null;
  readonly isDisabled?: boolean;
};

export const KickoffProjects = ({
  workspaceId,
  suggestedIds,
  reason = null,
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
  return (
    <section aria-label="Projects" className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="text-label text-foreground">Projects</span>
        <span className="text-meta text-faint-foreground">Optional</span>
      </div>
      <ProjectPicker
        projects={projects}
        value={projectIds}
        isDisabled={isDisabled}
        {...(suggestedIds !== undefined && { suggestedIds })}
        onChange={(next) => patchSessionDraft({ workspaceId, patch: { projectIds: next } })}
      />
      {reason === null ? null : <p className="text-meta text-muted-foreground">{reason}</p>}
    </section>
  );
};
