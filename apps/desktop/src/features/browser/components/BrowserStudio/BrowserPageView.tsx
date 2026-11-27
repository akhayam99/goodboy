import { useRef, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useReloadSurface } from '../../../../shared/hooks/useReloadSurface';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { demoteBrowserTab } from '../../demoteBrowserTab';
import { devicePresetOf } from '../../devicePresets';
import { useBrowserPane } from '../../hooks/useBrowserPane';
import { useBrowserStudioTab } from '../../hooks/useBrowserStudioTab';
import { useConsoleEntries } from '../../hooks/useConsoleEntries';
import { useElementPick } from '../../hooks/useElementPick';
import { useNativePlacement } from '../../hooks/useNativePlacement';
import { consoleCounts } from '../../consoleCounts';
import type { BrowserPageGroup, BrowserToolsTab } from '../../types';
import { BrowserAddressRow } from '../BrowserPane/BrowserAddressRow';
import type { BrowserStripGroups } from '../BrowserPane/BrowserTabStrip';
import { BrowserToolsDock } from '../BrowserToolsDock';
import { BrowserNotice } from '../BrowserPane/BrowserNotice';
import { BrowserPasskeyNotice } from '../BrowserPane/BrowserPasskeyNotice';
import { BrowserPickNote } from '../BrowserPane/BrowserPickNote';
import { BrowserSendLine } from '../BrowserPane/BrowserSendLine';
import { BrowserView } from '../BrowserPane/BrowserView';
import { BrowserPageTrail } from './BrowserPageTrail';

type Props = {
  readonly sessionId: SessionId;
  readonly tabId: string | null;
  readonly groups: ReadonlyArray<BrowserPageGroup>;
  readonly folded: ReadonlySet<string>;
  readonly onFoldedChange: BrowserStripGroups['onFoldedChange'];
};

type ShowParams = {
  readonly group: BrowserPageGroup;
  readonly tab: BrowserTab;
};

export const BrowserPageView = ({ sessionId, tabId, groups, folded, onFoldedChange }: Props) => {
  const model = useBrowserPane({ sessionId });
  const frame = useRef<HTMLDivElement | null>(null);
  const view = useRef<HTMLDivElement | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const shownTab = model.shown?.tab ?? null;
  const title = shownTab === null ? '' : model.titleOf({ tab: shownTab });
  const isOnScreen = useAppStore((state) => state.appStudio?.kind === 'browser');
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [toolsTab, setToolsTab] = useState<BrowserToolsTab>('console');
  const consoleLog = useConsoleEntries({
    sessionId,
    liveId: model.shownLiveId,
    isOpen: isOnScreen,
  });
  const errorCount = consoleCounts({ entries: consoleLog.entries }).errors;
  const pick = useElementPick({
    sessionId,
    liveId: model.shownLiveId,
    pageTitle: title,
    isShown: isOnScreen,
    shouldOpenSession: false,
    onError: model.showError,
  });

  useBrowserStudioTab({ sessionId, tabId, model });
  useReloadSurface({
    isEnabled: isOnScreen,
    isMain: true,
    hasNativeView: true,
    root,
    reload: model.reload,
    reloadFromOrigin: model.reloadFromOrigin,
  });
  const cover = useNativePlacement({
    sessionId,
    frame,
    view,
    tab: shownTab,
    attempt: model.wakeAttempt,
    maxWidth: devicePresetOf({ id: model.devicePreset }).width,
    onError: model.showError,
  });

  const showTab = ({ group, tab }: ShowParams): void => {
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
    <div ref={root} data-browser-page="" className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <BrowserPageTrail sessionId={sessionId} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1">
        <BrowserAddressRow
          model={model}
          isAddressShortcutOn={isOnScreen}
          consoleToggle={{
            isOpen: isConsoleOpen,
            onToggle: () => setIsConsoleOpen(!isConsoleOpen),
          }}
          errors={{
            count: errorCount,
            onShow: () => {
              setToolsTab('errors');
              setIsConsoleOpen(true);
            },
          }}
          pick={pick}
          page={{ groups, onPick: showTab, folded, onFoldedChange }}
          onDock={() => demoteBrowserTab({ sessionId })}
        />
        {pick.picks.length > 0 ? <BrowserPickNote pick={pick} /> : null}
        {model.error === null ? null : (
          <p role="alert" className="px-4 text-meta text-danger">
            {model.error}
          </p>
        )}
        <BrowserNotice notice={model.notice} />
        <BrowserSendLine pageSend={model.pageSend} />
        <BrowserPasskeyNotice model={model} />
        <BrowserToolsDock
          surface="page"
          isOpen={isConsoleOpen && shownTab !== null}
          model={model}
          title={title}
          log={consoleLog}
          tab={toolsTab}
          onTab={({ next }) => setToolsTab(next)}
          onClose={() => setIsConsoleOpen(false)}
        >
          <BrowserView
            frame={frame}
            view={view}
            shown={model.shown}
            title={title}
            cover={cover}
            devicePreset={model.devicePreset}
            onNew={model.startDraft}
          />
        </BrowserToolsDock>
      </div>
    </div>
  );
};
