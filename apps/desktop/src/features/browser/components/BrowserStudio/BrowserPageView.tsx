import { useRef } from 'react';
import { StudioRailLayout, useInnerColumn, useStudioRailFold } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useReloadSurface } from '../../../../shared/hooks/useReloadSurface';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { useBrowserPane } from '../../hooks/useBrowserPane';
import { useBrowserStudioTab } from '../../hooks/useBrowserStudioTab';
import { useNativePlacement } from '../../hooks/useNativePlacement';
import type { BrowserPageGroup } from '../../types';
import { BrowserAddressRow } from '../BrowserPane/BrowserAddressRow';
import { BrowserNotice } from '../BrowserPane/BrowserNotice';
import { BrowserPasskeyNotice } from '../BrowserPane/BrowserPasskeyNotice';
import { BrowserView } from '../BrowserPane/BrowserView';
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
  const root = useRef<HTMLDivElement | null>(null);
  const shownTab = model.shown?.tab ?? null;
  const title = shownTab === null ? '' : model.titleOf({ tab: shownTab });
  const isOnScreen = useAppStore((state) => state.appStudio?.kind === 'browser');

  useBrowserStudioTab({ sessionId, tabId, model });
  useReloadSurface({
    isEnabled: isOnScreen,
    isMain: true,
    hasNativeView: true,
    root,
    reload: model.reload,
  });
  useNativePlacement({
    sessionId,
    view,
    tab: shownTab,
    attempt: model.wakeAttempt,
    onError: model.showError,
  });

  const toggleList = (): void => {
    fold.setFolded(!fold.isCollapsed);
  };

  useInnerColumn({
    id: 'browser',
    label: fold.isCollapsed ? 'Show tabs by session' : 'Hide tabs by session',
    toggle: toggleList,
    isActive: true,
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
    <div ref={root} className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <BrowserPageTrail sessionId={sessionId} />
      <StudioRailLayout
        railLabel="Tabs by session"
        railWidth="standard"
        surface="browser"
        placement="page"
        isCollapsed={fold.isCollapsed}
        rail={<BrowserPageRail groups={groups} sessionId={sessionId} model={model} onPick={pick} />}
        detail={
          <div className="flex h-full min-h-0 min-w-0 flex-col gap-2 pb-2 pt-1">
            <BrowserAddressRow
              model={model}
              isAddressShortcutOn={isOnScreen}
              isListOpen={!fold.isCollapsed}
              onToggleList={toggleList}
            />
            {model.error === null ? null : (
              <p role="alert" className="px-4 text-meta text-danger">
                {model.error}
              </p>
            )}
            <BrowserNotice notice={model.notice} />
            <BrowserPasskeyNotice model={model} />
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
