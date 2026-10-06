import { ListFilter } from 'lucide-react';
import { Listbox } from '@goodboy/ui';
import type { Session, WorkspaceId } from '@goodboy/types';
import { useAppStore, useSelectedProjectIds } from '../../../store';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
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

  return (
    <Listbox
      multiple
      trigger="quiet"
      size="sm"
      align="end"
      noun="project"
      ariaLabel={activeCount > 0 ? `Project filter, ${activeCount} active` : 'Project filter'}
      value={selectedProjectIds}
      options={options.map((option) => ({
        value: option.id,
        label: option.label,
        meta: option.count,
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
