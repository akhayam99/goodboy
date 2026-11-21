import { useMemo } from 'react';
import { Listbox } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { ProjectMatch } from '../../../../../shared/components/ProjectPicker/projectMatch';
import { projectPickerOptions } from '../../../../../shared/components/ProjectPicker/projectPickerOptions';
import { ProjectStarHint } from '../../../../../shared/components/ProjectPicker/ProjectStarHint';
import { useProjectStarToggle } from '../../../../../shared/components/ProjectPicker/useProjectStarToggle';
import { useRecentProjectIds } from '../../../../../shared/components/ProjectPicker/useRecentProjectIds';
import { NAMES } from '../../../../../shared/utils/names';
import { START_KIND_COPY } from '../../../startKind/startKindCopy';
import { START_PICK_TRIGGER } from '../startPickTrigger';
import { useDraftProjects } from './useDraftProjects';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly match: ProjectMatch | null;
  readonly isDisabled: boolean;
};

type ValueParams = {
  readonly names: ReadonlyArray<string>;
};

const whereValueOf = ({ names }: ValueParams): string => {
  const [first] = names;
  if (first === undefined) {
    return START_KIND_COPY.where.auto;
  }
  if (names.length === 1) {
    return first;
  }
  return START_KIND_COPY.where.count({ count: names.length });
};

export const WhereChip = ({ workspaceId, match, isDisabled }: Props) => {
  const { projects, projectIds, names } = useDraftProjects({ workspaceId });
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const recentIds = useRecentProjectIds({ workspaceId });
  const stars = useProjectStarToggle();
  const matchId = match?.projectId ?? null;
  const matchReason = match?.reason ?? '';
  const options = useMemo(
    () =>
      projectPickerOptions({
        projects,
        recentIds,
        match: matchId === null ? null : { projectId: matchId, reason: matchReason },
        stars,
      }),
    [projects, recentIds, matchId, matchReason, stars],
  );
  if (projects.length === 0) {
    return null;
  }
  const hasStarred = projects.some((project) => project.starredAt !== undefined);
  const value = whereValueOf({ names });

  return (
    <Listbox
      multiple
      ariaLabel={START_KIND_COPY.where.label}
      size="sm"
      searchable
      searchLabel={NAMES.searchProjects}
      searchPlaceholder={NAMES.searchProjects}
      emptyLabel="No projects in this workspace"
      noMatchLabel="No projects match"
      options={options}
      value={projectIds}
      disabled={isDisabled}
      onChange={(next) => patchSessionDraft({ workspaceId, patch: { projectIds: next } })}
      className={START_PICK_TRIGGER}
      status={
        stars.failure === null ? undefined : (
          <span role="alert" className="text-danger">
            {stars.failure}
          </span>
        )
      }
      footer={hasStarred ? undefined : () => <ProjectStarHint />}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          stars.dismiss();
        }
      }}
      valueLabel={
        <>
          <span className="shrink-0 text-faint-foreground">{START_KIND_COPY.where.label}:</span>
          <span className="min-w-0 truncate text-foreground">{value}</span>
        </>
      }
    />
  );
};
