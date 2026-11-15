import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button, HeaderActions, ICON_SIZE, PaneShell, ScrollFade } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { NAMES } from '../../../../shared/utils/names';
import type { WorkFilter } from '../../../../store/slices/work/state';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import { useWorkLeads } from '../../hooks/useWorkLeads';
import { openWorkLead } from '../../openWorkLead';
import type { StartWorkPort } from '../../startWorkPort';
import { ExperimentalPill } from './ExperimentalPill';
import { WorkEmpty } from './WorkEmpty';
import { WorkFilterTabs } from './WorkFilterTabs';
import { WorkRow } from './WorkRow';
import { WorkSkeleton } from './WorkSkeleton';
import { WorkStaleNotice } from './WorkStaleNotice';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly filter: WorkFilter;
  readonly onFilterChange: (filter: WorkFilter) => void;
  readonly startWork: StartWorkPort | null;
  readonly composer?: ReactNode;
};

export const WorkPage = ({
  workspaceId,
  filter,
  onFilterChange,
  startWork,
  composer = null,
}: Props) => {
  const model = useWorkLeads({ workspaceId, filter });
  const projects = useAppStore((state) => state.projects);
  return (
    <PaneShell
      page="work"
      scroll="body"
      title="Work"
      badge={<ExperimentalPill />}
      meta="Every Lead of this workspace. A row opens it in its session."
      actions={
        <HeaderActions
          primary={
            startWork === null ? null : (
              <Button onClick={startWork.onStart}>
                <Plus size={ICON_SIZE.control} aria-hidden />
                {NAMES.startWork}
              </Button>
            )
          }
        />
      }
      toolbar={<WorkFilterTabs filter={filter} counts={model.counts} onChange={onFilterChange} />}
    >
      <ScrollFade viewportClassName="flex flex-col gap-1 pb-6">
        {composer}
        {model.isStale ? <WorkStaleNotice onRetry={model.retry} /> : null}
        {model.isLoading ? <WorkSkeleton /> : null}
        {!model.isLoading && model.rows.length === 0 ? <WorkEmpty filter={filter} /> : null}
        {model.isLoading
          ? null
          : model.rows.map((row) => (
              <WorkRow
                key={row.treeId}
                row={row}
                projectName={projectById(projects, row.projectId)?.name ?? null}
                onOpen={() => openWorkLead({ sessionId: row.sessionId, agentId: row.rootAgentId })}
              />
            ))}
      </ScrollFade>
    </PaneShell>
  );
};
