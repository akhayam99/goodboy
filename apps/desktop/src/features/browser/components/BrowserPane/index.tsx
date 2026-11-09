import { useRef, useState } from 'react';
import { DrawerFrame } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useBrowserPane } from '../../hooks/useBrowserPane';
import { useNativePlacement } from '../../hooks/useNativePlacement';
import { BrowserAddressRow } from './BrowserAddressRow';
import { BrowserTabList } from './BrowserTabList';
import { BrowserTabStrip } from './BrowserTabStrip';
import { BrowserView } from './BrowserView';

type Props = {
  readonly sessionId: SessionId;
  readonly onClose: () => void;
};

export const BrowserPane = ({ sessionId, onClose }: Props) => {
  const model = useBrowserPane({ sessionId });
  const view = useRef<HTMLDivElement | null>(null);
  const [isListOpen, setIsListOpen] = useState(false);
  const shownTab = model.shown?.tab ?? null;
  const title = shownTab === null ? '' : model.titleOf({ tab: shownTab });
  const hasTabs = model.tabs.length > 0 || model.pins.length > 0;

  useNativePlacement({ sessionId, view, tab: shownTab, onError: model.showError });

  return (
    <DrawerFrame title="Browser" isHeaderless onClose={onClose}>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <BrowserAddressRow
          model={model}
          isListOpen={isListOpen}
          onToggleList={() => setIsListOpen((isOpen) => !isOpen)}
          onClose={onClose}
        />
        {model.error === null ? null : (
          <p role="alert" className="px-4 text-meta text-danger">
            {model.error}
          </p>
        )}
        {hasTabs && !isListOpen ? <BrowserTabStrip model={model} /> : null}
        <div className="flex min-h-0 flex-1 gap-2 px-2 pb-2">
          {isListOpen ? <BrowserTabList model={model} /> : null}
          <BrowserView view={view} shown={model.shown} title={title} />
        </div>
      </div>
    </DrawerFrame>
  );
};
