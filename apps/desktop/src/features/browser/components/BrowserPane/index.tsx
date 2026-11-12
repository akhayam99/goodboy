import { useRef, useState } from 'react';
import { DrawerFrame } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectDrawerPanel } from '../../../../store/slices/drawer/selectDrawerPanel';
import { browserTabListPref } from '../../browserTabListPref';
import { useBrowserPane } from '../../hooks/useBrowserPane';
import { useNativePlacement } from '../../hooks/useNativePlacement';
import { promoteBrowserTab } from '../../promoteBrowserTab';
import { BrowserAddressRow } from './BrowserAddressRow';
import { BrowserPasskeyNotice } from './BrowserPasskeyNotice';
import { BrowserTabList } from './BrowserTabList';
import { BrowserTabStrip } from './BrowserTabStrip';
import { BrowserView } from './BrowserView';

type Props = {
  readonly sessionId: SessionId;
  readonly onClose: () => void;
};

export const BrowserPane = ({ sessionId, onClose }: Props) => {
  const model = useBrowserPane({ sessionId });
  const frame = useRef<HTMLDivElement | null>(null);
  const view = useRef<HTMLDivElement | null>(null);
  const [isListOpen, setIsListOpen] = useState(browserTabListPref.read);
  const shownTab = model.shown?.tab ?? null;
  const title = shownTab === null ? '' : model.titleOf({ tab: shownTab });
  const hasTabs = model.tabs.length > 0 || model.pins.length > 0;
  const isOnScreen = useAppStore((state) => selectDrawerPanel(state)?.kind === 'browser');

  useNativePlacement({
    sessionId,
    frame,
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
          onToggleList={() => {
            browserTabListPref.write(!isListOpen);
            setIsListOpen(!isListOpen);
          }}
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
        <div className="flex min-h-0 flex-1 gap-2 px-2 pb-2">
          {isListOpen ? <BrowserTabList model={model} /> : null}
          <BrowserView frame={frame} view={view} shown={model.shown} title={title} />
        </div>
      </div>
    </DrawerFrame>
  );
};
