import { useEffect, useState } from 'react';
import type { IsoDateTime } from '@goodboy/types';
import { useAppStore, type LensKind } from '../../../../../store';
import { SideColumn } from '../../../SideColumn';
import { ColumnRail } from '../../../SideColumn/ColumnRail';
import type { ColumnActions } from '../../../SideColumn/columnDoors';
import type { ColumnPlace } from '../../../SideColumn/columnPlace';
import { sceneClock } from '../../sceneClock';
import { SIDEBAR_NAV_DEFAULTS, seedSidebarNav, type SidebarNavSeed } from '../u23/sidebarNavSeed';
import { seedSideInfoValues } from './seedSideInfoValues';

const clock = sceneClock({ anchor: '2026-10-16T09:00:00.000Z' });

const at = (iso: string): IsoDateTime => clock.iso({ at: iso });

const noop = () => undefined;

const ACTIONS: ColumnActions = {
  openBoard: noop,
  openInbox: noop,
  openChat: noop,
  openWorkflows: noop,
  openTerminalStudio: noop,
  openNewChat: noop,
  openNewTerminal: noop,
  openMonitoring: noop,
  openSettings: noop,
  openChangelog: noop,
  openGuide: noop,
  openShortcuts: noop,
};

export type LevelsSceneConfig = {
  readonly lens: LensKind | null;
  readonly branches: number;
  readonly isBusy: boolean;
  readonly isLeft: boolean;
  readonly isFolded: boolean;
  readonly place: ColumnPlace;
};

type SeedBusyParams = {
  readonly seed: SidebarNavSeed;
};

const seedBusy = ({ seed }: SeedBusyParams): void => {
  seedSideInfoValues();
  const sessionId = seed.session.id;
  useAppStore.setState((state) => ({
    sessionExternalTasks: {
      ...state.sessionExternalTasks,
      [sessionId]: [
        {
          sessionId,
          provider: 'linear',
          externalId: 'nw-142',
          identifier: 'NW-142',
          title: 'Retry webhook deliveries on a 502',
          url: 'https://linear.app/northwind/issue/NW-142',
          createdAt: at('2026-10-15T09:00:00.000Z'),
        },
      ],
    },
  }));
};

type Props = {
  readonly config: Partial<LevelsSceneConfig>;
};

export const LevelsScene = ({ config }: Props) => {
  const [seed, setSeed] = useState<SidebarNavSeed | null>(null);
  const place = config.place ?? null;
  useEffect(() => {
    const next = seedSidebarNav({
      ...SIDEBAR_NAV_DEFAULTS,
      lens: config.lens ?? null,
      branches: config.branches ?? 3,
      hasPullRequest: true,
      hasQuestion: config.isBusy === true,
      pinCount: 2,
    });
    if (config.isBusy === true) {
      seedBusy({ seed: next });
    }
    if (place === 'board') {
      useAppStore.setState({ currentSessionId: null });
    }
    if (config.isLeft === true) {
      useAppStore.getState().leaveSessionLevel();
    }
    setSeed(next);
  }, [config, place]);
  if (seed === null) {
    return null;
  }
  const currentSessionId = place === 'board' ? null : seed.session.id;
  return (
    <div data-shot className="flex h-screen min-h-0 bg-background">
      <div className="h-full shrink-0 border-r border-border-soft">
        {config.isFolded === true ? (
          <ColumnRail
            scope="workspace"
            workspaceId={seed.workspaceId}
            currentSessionId={currentSessionId}
            place={place}
            onToggle={noop}
            actions={ACTIONS}
          />
        ) : (
          <div className="h-full w-60">
            <SideColumn
              scope="workspace"
              workspaceId={seed.workspaceId}
              currentSessionId={currentSessionId}
              place={place}
              isCollapsed={false}
              actions={ACTIONS}
              onToggle={noop}
            />
          </div>
        )}
      </div>
      <main className="flex min-w-0 flex-1 flex-col gap-2 p-6">
        <h1 className="text-title text-foreground">{seed.session.goal}</h1>
      </main>
    </div>
  );
};
