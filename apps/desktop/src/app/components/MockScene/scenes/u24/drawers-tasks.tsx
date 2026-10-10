import { useEffect, useState } from 'react';
import { AppShell, DrawerFrame, PaneShell } from '@goodboy/ui';
import { StudioFrame } from '../../../StudioFrame';
import { shellArrangement } from '../../../../shellArrangement';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { InboxFacetRail } from '../../../../../features/inbox/components/InboxStudio/InboxFacetRail';
import { InboxStudioLayout } from '../../../../../features/inbox/components/InboxStudio/InboxStudioLayout';
import { NO_INBOX_FILTERS, inboxFacetCounts } from '../../../../../features/inbox/kindFilter';
import type { InboxProvider } from '../../../../../features/inbox/types';
import { seedBoardScene } from '../BoardScene';
import { seedStudioChrome } from '../shellChrome';

const WINDOW_WIDTH_PX = 1440;

const noop = () => undefined;

const CONNECTED: ReadonlyArray<InboxProvider> = ['github', 'linear'];

const NOT_LOADING: Record<InboxProvider, boolean> = {
  github: false,
  gitlab: false,
  bitbucket: false,
  linear: false,
  jira: false,
  slack: false,
  sentry: false,
};

const NO_ERRORS: Record<InboxProvider, string | null> = {
  github: null,
  gitlab: null,
  bitbucket: null,
  linear: null,
  jira: null,
  slack: null,
  sentry: null,
};

const arrangement = shellArrangement({
  hasWorkspace: true,
  hasActiveSession: false,
  isSidebarCollapsed: false,
  mode: 'column',
});

const ROWS = [
  'Refunds on split payments leave the second charge captured',
  'The admin sessions table loads every row at once',
  'Checkout retries charge twice',
  'Settlement export off by a few cents',
];

const DrawerSplitTasks = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedBoardScene();
    seedStudioChrome();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <div
      data-testid="drawer-split-tasks"
      className="[&_.w-screen]:w-full"
      style={{ width: WINDOW_WIDTH_PX }}
    >
      <AppShell
        leftHidden={arrangement.leftHidden}
        leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
        leftSidebar={<div aria-hidden />}
        main={<div />}
        studioCoversLeft={false}
        studio={
          <StudioFrame kind="inbox" placement="content" onClose={noop}>
            <InboxStudioLayout
              rail={
                <InboxFacetRail
                  filters={NO_INBOX_FILTERS}
                  counts={inboxFacetCounts({ records: [], query: '', filters: NO_INBOX_FILTERS })}
                  connected={CONNECTED}
                  loading={NOT_LOADING}
                  errors={NO_ERRORS}
                  onFiltersChange={noop}
                  onClearFilters={noop}
                />
              }
              railHeader={null}
              list={() => (
                <PaneShell scroll="body" title="Tasks" meta={`${ROWS.length} items`}>
                  <ul className="flex flex-col gap-2 text-row text-foreground">
                    {ROWS.map((row) => (
                      <li key={row}>{row}</li>
                    ))}
                  </ul>
                </PaneShell>
              )}
              drawer={
                <DrawerFrame title="CAS-231" icon={CONCEPT_ICONS.inbox} onClose={noop}>
                  <p className="px-4 text-body text-foreground">{ROWS[0]}</p>
                </DrawerFrame>
              }
            />
          </StudioFrame>
        }
      />
    </div>
  );
};

export const U24_DRAWERS_TASKS_SCENES = {
  'drawer-split-tasks': DrawerSplitTasks,
};
