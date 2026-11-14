import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { StudioShell } from '../../../shared/components/StudioShell';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { WORK_FILTERS, type WorkFilter } from '../../../store/slices/work/state';
import { WorkPage } from './WorkPage';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly filter: WorkFilter | undefined;
  readonly onClose: () => void;
};

export const WorkStudio = ({ workspaceId, filter, onClose }: Props) => {
  const amendStudio = useAppStore((state) => state.amendStudio);
  const shown = filter !== undefined && WORK_FILTERS.includes(filter) ? filter : 'open';
  return (
    <StudioShell icon={CONCEPT_ICONS.work} tone={CONCEPT_TONE.work} title="Work" onClose={onClose}>
      {() => (
        <WorkPage
          workspaceId={workspaceId}
          filter={shown}
          onFilterChange={(next) => amendStudio({ studio: { kind: 'work', filter: next } })}
          startWork={null}
        />
      )}
    </StudioShell>
  );
};
