import { ListFilter, Star } from 'lucide-react';
import { Listbox } from '@goodboy/ui';
import type { Session, WorkspaceId } from '@goodboy/types';
import { NO_PROJECT_FILTER_ID, useAppStore, useSelectedProjectIds } from '../../../store';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import { shouldGroupStarred } from '../../../shared/utils/shouldGroupStarred';
import { useProjectFilterOptions } from '../hooks/useProjectFilterOptions';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessions: ReadonlyArray<Session>;
};

export const ProjectFilter = ({ workspaceId, sessions }: Props) => {
  const selectedProjectIds = useSelectedProjectIds({ workspaceId });
  const setSelectedProjectIds = useAppStore((state) => state.setSelectedProjectIds);
  const options = useProjectFilterOptions({ workspaceId, sessions });

  const activeCount = selectedProjectIds.length;
  const projectOptions = options.filter((option) => option.id !== NO_PROJECT_FILTER_ID);
  const isGrouped = shouldGroupStarred({
    starredCount: projectOptions.filter((option) => option.isStarred).length,
    total: projectOptions.length,
  });

  return (
    <Listbox
      multiple
      trigger="quiet"
      size="sm"
      align="end"
      noun="project"
      ariaLabel={activeCount > 0 ? `Project filter, ${activeCount} active` : 'Project filter'}
      value={selectedProjectIds}
      shouldFlattenOnSearch
      options={options.map((option) => ({
        value: option.id,
        label: option.label,
        meta: option.count,
        ...(option.isStarred
          ? {
              leading: (
                <Star size={ICON_SIZE.mark} aria-hidden className="fill-current text-warning" />
              ),
            }
          : {}),
        ...(isGrouped && option.id !== NO_PROJECT_FILTER_ID
          ? { group: option.isStarred ? 'Starred' : 'Other projects' }
          : {}),
      }))}
      onChange={(next) => setSelectedProjectIds({ workspaceId, selectedProjectIds: next })}
      valueLabel={
        <>
          <ListFilter size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          {activeCount > 0 ? <span className="tabular-nums">{activeCount}</span> : null}
        </>
      }
    />
  );
};
