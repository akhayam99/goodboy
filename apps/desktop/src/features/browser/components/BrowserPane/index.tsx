import { useRef } from 'react';
import { DrawerFrame } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useReloadSurface } from '../../../../shared/hooks/useReloadSurface';
import { selectDockDrawer } from '../../../../store/slices/drawer/selectDockDrawer';
import { useBrowserPane } from '../../hooks/useBrowserPane';
import { useBrowserTools } from '../../hooks/useBrowserTools';
import { useConsoleEntries } from '../../hooks/useConsoleEntries';
import { useElementPick } from '../../hooks/useElementPick';
import { useNativePlacement } from '../../hooks/useNativePlacement';
import { useParkedTab } from '../../hooks/useParkedTab';
import { consoleCounts } from '../../consoleCounts';
import { devicePresetOf } from '../../devicePresets';
import { promoteBrowserTab } from '../../promoteBrowserTab';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/utils/names';
import { BrowserAddressRow } from './BrowserAddressRow';
import { BrowserToolsDock } from '../BrowserToolsDock';
import { BrowserNotice } from './BrowserNotice';
import { BrowserPasskeyNotice } from './BrowserPasskeyNotice';
import { BrowserPickNote } from './BrowserPickNote';
import { BrowserSendLine } from './BrowserSendLine';
import { BrowserView } from './BrowserView';

type Props = {
  readonly sessionId: SessionId;
  readonly onClose: () => void;
};

export const BrowserPane = ({ sessionId, onClose }: Props) => {
  const model = useBrowserPane({ sessionId });
  const frame = useRef<HTMLDivElement | null>(null);
  const view = useRef<HTMLDivElement | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const shownTab = model.shown?.tab ?? null;
  const title = shownTab === null ? '' : model.titleOf({ tab: shownTab });
  const isOnScreen = useAppStore((state) => selectDockDrawer({ state })?.kind === 'browser');
  const boundLiveId = useAppStore((state) =>
    shownTab === null ? undefined : state.browserLiveTabs[sessionId]?.[shownTab.id],
  );
  const parked = useParkedTab({ sessionId, liveId: boundLiveId });
  const consoleLog = useConsoleEntries({
    sessionId,
    liveId: model.shownLiveId,
    isOpen: isOnScreen,
  });
  const tools = useBrowserTools({
    errorCount: consoleCounts({ entries: consoleLog.entries }).errors,
  });

  useReloadSurface({
    isEnabled: isOnScreen,
    isMain: false,
    hasNativeView: true,
    root,
    reload: model.reload,
    reloadFromOrigin: model.reloadFromOrigin,
  });

  const pick = useElementPick({
    sessionId,
    liveId: model.shownLiveId,
    pageTitle: title,
    isShown: isOnScreen,
    onError: model.showError,
  });

  const cover = useNativePlacement({
    sessionId,
    frame,
    view,
    tab: parked.isParked || parked.isChecking ? null : shownTab,
    attempt: model.wakeAttempt,
    maxWidth: devicePresetOf({ id: model.devicePreset }).width,
    onError: model.showError,
  });

  return (
    <DrawerFrame
      isDock
      title="Browser"
      icon={CONCEPT_ICONS.browser}
      page={{
        label: NAMES.openFullPage,
        onOpen: () => promoteBrowserTab({ sessionId, tabId: shownTab?.id ?? null }),
      }}
      onClose={onClose}
      scroll="self"
    >
      <div ref={root} className="flex min-h-0 flex-1 flex-col gap-1">
        <BrowserAddressRow
          model={model}
          isAddressShortcutOn={isOnScreen}
          tools={tools}
          pick={pick}
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
          surface="pane"
          tools={tools}
          hasTab={shownTab !== null}
          model={model}
          title={title}
          log={consoleLog}
        >
          <BrowserView
            frame={frame}
            view={view}
            shown={model.shown}
            title={title}
            cover={cover}
            devicePreset={model.devicePreset}
            onNew={model.startDraft}
            onWake={parked.isParked ? parked.wake : undefined}
          />
        </BrowserToolsDock>
      </div>
    </DrawerFrame>
  );
};
