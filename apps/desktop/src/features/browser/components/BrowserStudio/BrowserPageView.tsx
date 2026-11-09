import { useRef } from 'react';
import { Button, StudioRailLayout, useStudioRailFold } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { demoteBrowserTab } from '../../demoteBrowserTab';
import { useBrowserPane } from '../../hooks/useBrowserPane';
import { useBrowserStudioTab } from '../../hooks/useBrowserStudioTab';
import { useNativePlacement } from '../../hooks/useNativePlacement';
import type { BrowserPageGroup } from '../../types';
import { BrowserAddressRow } from '../BrowserPane/BrowserAddressRow';
import { BrowserView } from '../BrowserPane/BrowserView';
import { BrowserPageHeader } from './BrowserPageHeader';
import { BrowserPageRail } from './BrowserPageRail';
import { BrowserPageTrail } from './BrowserPageTrail';

type Props = {
  readonly sessionId: SessionId;
  readonly tabId: string | null;
  readonly groups: ReadonlyArray<BrowserPageGroup>;
};

type PickParams = {
  readonly group: BrowserPageGroup;
  readonly tab: BrowserTab;
};

export const BrowserPageView = ({ sessionId, tabId, groups }: Props) => {
  const model = useBrowserPane({ sessionId });
  const fold = useStudioRailFold({ surface: 'browser' });
  const view = useRef<HTMLDivElement | null>(null);
  const shownTab = model.shown?.tab ?? null;
  const title = shownTab === null ? '' : model.titleOf({ tab: shownTab });
  const isOnScreen = useAppStore((state) => state.appStudio?.kind === 'browser');

  useBrowserStudioTab({ sessionId, tabId, model });
  useNativePlacement({
    sessionId,
    view,
    tab: shownTab,
    attempt: model.wakeAttempt,
    onError: model.showError,
  });

  const pick = ({ group, tab }: PickParams): void => {
    const state = useAppStore.getState();
    if (group.sessionId === sessionId) {
      model.select({ tab });
    }
    if (group.sessionId !== sessionId && group.isPins) {
      state.showBrowserPin({ sessionId: group.sessionId, tabId: tab.id });
    }
    if (group.sessionId !== sessionId && !group.isPins) {
      state.activateBrowserTab({ sessionId: group.sessionId, tabId: tab.id });
    }
    state.amendStudio({ studio: { kind: 'browser', sessionId: group.sessionId, tabId: tab.id } });
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <BrowserPageTrail sessionId={sessionId} />
      <BrowserPageHeader
        actions={
          <Button variant="secondary" size="sm" onClick={() => demoteBrowserTab({ sessionId })}>
            Back beside the session
          </Button>
        }
      />
      <StudioRailLayout
        railLabel="Tabs by session"
        railWidth="standard"
        surface="browser"
        placement="page"
        isCollapsed={fold.isCollapsed}
        onCollapsedChange={fold.setFolded}
        rail={<BrowserPageRail groups={groups} sessionId={sessionId} model={model} onPick={pick} />}
        detail={
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 pb-2">
            <BrowserAddressRow model={model} isAddressShortcutOn={isOnScreen} />
            {model.error === null ? null : (
              <p role="alert" className="px-4 text-meta text-danger">
                {model.error}
              </p>
            )}
            <div className="flex min-h-0 flex-1 px-2">
              <BrowserView
                view={view}
                shown={model.shown}
                title={title}
                emptyTitle="Open a page in this session"
              />
            </div>
          </div>
        }
      />
    </div>
  );
};
