import { useEffect, useState } from 'react';
import { useAppStore, useCurrentSession } from '../../../../../store';
import { SessionLevel } from '../../../SessionRail/SessionLevel';
import { SessionPageTabs } from '../../../SessionPageTabs';
import { SessionHeaderActions } from '../../../SessionActions/SessionHeaderActions';
import { SideColumn } from '../../../SideColumn';
import type { ColumnActions } from '../../../SideColumn/columnDoors';
import type { ColumnPlace } from '../../../../../shared/navigation/columnPlace';
import {
  SIDEBAR_NAV_DEFAULTS,
  seedSidebarNav,
  type SidebarNavConfig,
  type SidebarNavSeed,
} from './sidebarNavSeed';

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
  readonly config: Partial<SidebarNavConfig>;
  readonly place?: ColumnPlace;
  readonly isFramed?: boolean;
  readonly onSeeded?: () => void;
  readonly isSessionLevel?: boolean;
};

export const SidebarNavColumnScene = ({
  config,
  place = null,
  isFramed = false,
  onSeeded,
  isSessionLevel = false,
}: Props) => {
  const [seed, setSeed] = useState<SidebarNavSeed | null>(null);
  const current = useCurrentSession();
  useEffect(() => {
    const next = seedSidebarNav({ ...SIDEBAR_NAV_DEFAULTS, ...config });
    if (place === 'new') {
      useAppStore.setState({
        openSessionDraftWorkspaceId: next.workspaceId,
        currentSessionId: null,
      });
    }
    onSeeded?.();
    setSeed(next);
  }, [config, place, onSeeded]);
  if (seed === null) {
    return null;
  }
  if (isFramed) {
    return (
      <div data-shot className="flex h-[600px] bg-background">
        <div className="h-full w-72 shrink-0">
          <SideColumn
            scope="workspace"
            workspaceId={seed.workspaceId}
            currentSessionId={seed.session.id}
            place={place}
            actions={ACTIONS}
          />
        </div>
        {isSessionLevel ? (
          <aside
            aria-label="Session level"
            className="flex h-full w-[640px] shrink-0 flex-col gap-3 bg-background pt-3"
          >
            <div className="flex items-center justify-between gap-3 px-4">
              <SessionPageTabs session={current ?? seed.session} />
              <SessionHeaderActions session={current ?? seed.session} />
            </div>
            <div className="w-60">
              <SessionLevel session={current ?? seed.session} isActive />
            </div>
          </aside>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex h-screen min-h-0 bg-background">
      <div className="h-full w-64 shrink-0 border-r border-border-soft">
        <SideColumn
          scope="workspace"
          workspaceId={seed.workspaceId}
          currentSessionId={seed.session.id}
          place={place}
          actions={ACTIONS}
        />
      </div>
    </div>
  );
};
