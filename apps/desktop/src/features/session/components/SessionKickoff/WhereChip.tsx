import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Listbox } from '@goodboy/ui';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { projectPickerOptions } from '../../../../shared/components/ProjectPicker/projectPickerOptions';
import { starredProjectsFirst } from '../../../../shared/utils/starredProjectsFirst';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import { START_PICK_TRIGGER } from './startPickTrigger';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly suggestedIds: ReadonlyArray<ProjectId>;
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

export const WhereChip = ({ workspaceId, suggestedIds, isDisabled }: Props) => {
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
  const options = useMemo(
    () => projectPickerOptions({ projects, suggestedIds }),
    [projects, suggestedIds],
  );
  if (projects.length === 0) {
    return null;
  }
  const value = whereValueOf({
    names: projects
      .filter((project) => projectIds.includes(project.id))
      .map((project) => project.name),
  });

  return (
    <Listbox
      multiple
      ariaLabel={START_KIND_COPY.where.label}
      size="sm"
      searchable
      searchLabel="Search folders"
      searchPlaceholder="Search folders"
      emptyLabel="No folders in this workspace"
      noMatchLabel="No folders match"
      options={options}
      value={projectIds}
      disabled={isDisabled}
      onChange={(next) => patchSessionDraft({ workspaceId, patch: { projectIds: next } })}
      className={START_PICK_TRIGGER}
      valueLabel={
        <>
          <span className="shrink-0 text-faint-foreground">{START_KIND_COPY.where.label}</span>
          <span className="min-w-0 truncate text-foreground">{value}</span>
        </>
      }
    />
  );
};
