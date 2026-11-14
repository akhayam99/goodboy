import { useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { WorkFilter } from '../../../../../store/slices/work/state';
import { SETTING_WORK_ENABLED } from '../../../../../shared/lib/workSetting';
import { WorkStudio } from '../../../../../features/work/components/WorkStudio';
import { SideColumn } from '../../../SideColumn';
import type { ColumnActions } from '../../../SideColumn/columnDoors';
import { PageSheet } from '../PageSheet';
import { SIDEBAR_NAV_DEFAULTS, seedSidebarNav } from '../u23/sidebarNavSeed';
import { PROJECTS } from '../u24/monitoringSeed';
import { workListLeads, workListTurns } from './workListSeed';

const noop = () => undefined;

const ACTIONS: ColumnActions = {
  openBoard: noop,
  openInbox: noop,
  openWork: noop,
  openChat: noop,
  openWorkflows: noop,
  openNewChat: noop,
  openMonitoring: noop,
  openImpact: noop,
  openSettings: noop,
  openChangelog: noop,
  openGuide: noop,
};

type Props = {
  readonly filter: WorkFilter;
  readonly isLoading?: boolean;
};

const WorkListScene = ({ filter, isLoading = false }: Props) => {
  const [workspaceId, setWorkspaceId] = useState<WorkspaceId | null>(null);

  useEffect(() => {
    const seed = seedSidebarNav(SIDEBAR_NAV_DEFAULTS);
    useAppStore.setState({
      settings: { ...useAppStore.getState().settings, [SETTING_WORK_ENABLED]: 'true' },
      loadWorkLeads: async () => undefined,
      projects: PROJECTS.map((project) => ({ ...project, workspaceId: seed.workspaceId })),
      workLeads: workListLeads(),
      workWorkspaceId: isLoading ? null : seed.workspaceId,
      workFilter: filter,
      isWorkStale: false,
      agentTurnState: workListTurns(),
      currentSessionId: null,
    });
    useAppStore.getState().openStudio({ studio: { kind: 'work', filter } });
    setWorkspaceId(seed.workspaceId);
  }, [filter, isLoading]);

  if (workspaceId === null) {
    return null;
  }
  return (
    <main className="flex h-screen overflow-hidden bg-background text-foreground">
      <div className="h-full w-64 shrink-0">
        <SideColumn
          scope="workspace"
          workspaceId={workspaceId}
          currentSessionId={null}
          place="work"
          actions={ACTIONS}
        />
      </div>
      <PageSheet>
        <WorkStudio workspaceId={workspaceId} filter={filter} onClose={noop} />
      </PageSheet>
    </main>
  );
};

export const U42_WORK_LIST_SCENES = {
  'work-list': () => <WorkListScene filter="open" />,
  'work-list-needs-you': () => <WorkListScene filter="needsYou" />,
  'work-list-loading': () => <WorkListScene filter="open" isLoading />,
};
