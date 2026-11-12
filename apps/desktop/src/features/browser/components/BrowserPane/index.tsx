import { useRef, useState } from 'react';
import { DrawerFrame } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectDrawerPanel } from '../../../../store/slices/drawer/selectDrawerPanel';
import { useElementWidth } from '../../../../shared/hooks/useElementWidth';
import { browserTabListPref } from '../../browserTabListPref';
import type { BrowserTabListMode } from '../../types';
import { useBrowserPane } from '../../hooks/useBrowserPane';
import { useNativePlacement } from '../../hooks/useNativePlacement';
import { promoteBrowserTab } from '../../promoteBrowserTab';
import { BrowserAddressRow } from './BrowserAddressRow';
import { BrowserPasskeyNotice } from './BrowserPasskeyNotice';
import { BrowserTabList } from './BrowserTabList';
import { BrowserTabStrip } from './BrowserTabStrip';
import { BrowserView } from './BrowserView';

const NARROW_PANE_PX = 560;

type ModeParams = {
  readonly next: BrowserTabListMode;
};

type Props = {
  readonly sessionId: SessionId;
  readonly onClose: () => void;
};

export const BrowserPane = ({ sessionId, onClose }: Props) => {
  const model = useBrowserPane({ sessionId });
  const view = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<BrowserTabListMode>(browserTabListPref.read);
  const { ref: paneRef, width } = useElementWidth();
  const isListOpen = mode !== 'hidden';
  const isNarrow = width !== null && width < NARROW_PANE_PX;
  const isRail = mode === 'rail' || isNarrow;
  const changeMode = ({ next }: ModeParams): void => {
    browserTabListPref.write({ mode: next });
    setMode(next);
  };
  const shownTab = model.shown?.tab ?? null;
  const title = shownTab === null ? '' : model.titleOf({ tab: shownTab });
  const hasTabs = model.tabs.length > 0 || model.pins.length > 0;
  const isOnScreen = useAppStore((state) => selectDrawerPanel(state)?.kind === 'browser');

  useNativePlacement({
    sessionId,
    view,
    tab: shownTab,
    attempt: model.wakeAttempt,
    onError: model.showError,
  });

  return (
    <DrawerFrame title="Browser" isHeaderless onClose={onClose}>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <BrowserAddressRow
          model={model}
          isAddressShortcutOn={isOnScreen}
          isListOpen={isListOpen}
          onToggleList={() => changeMode({ next: isListOpen ? 'hidden' : 'list' })}
          onOpenAsPage={() => promoteBrowserTab({ sessionId, tabId: shownTab?.id ?? null })}
          onClose={onClose}
        />
        {model.error === null ? null : (
          <p role="alert" className="px-4 text-meta text-danger">
            {model.error}
          </p>
        )}
        <BrowserPasskeyNotice model={model} />
        {hasTabs && !isListOpen ? <BrowserTabStrip model={model} /> : null}
        <div ref={paneRef} className="flex min-h-0 flex-1 gap-2 px-2 pb-2">
          {isListOpen ? (
            <BrowserTabList
              model={model}
              isRail={isRail}
              canFold={!isNarrow}
              onFold={() => changeMode({ next: isRail ? 'list' : 'rail' })}
            />
          ) : null}
          <BrowserView view={view} shown={model.shown} title={title} />
        </div>
      </div>
    </DrawerFrame>
  );
};
