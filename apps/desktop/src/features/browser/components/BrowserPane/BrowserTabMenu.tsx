import { Bot } from 'lucide-react';
import { ContextMenu, type MenuEntry, type MenuPoint } from '@goodboy/ui';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import type { BrowserPaneModel } from '../../types';

type Props = {
  readonly model: BrowserPaneModel;
  readonly tab: BrowserTab;
  readonly point: MenuPoint;
  readonly onClose: () => void;
};

const MENU_LABEL = 'Tab';

export const BrowserTabMenu = ({ model, tab, point, onClose }: Props) => {
  const entries: ReadonlyArray<MenuEntry> = [
    {
      kind: 'item',
      key: 'sendToAgent',
      label: model.pageSend.label,
      icon: Bot,
      isDisabled: model.pageSend.isBusy || !model.pageSend.canSendTab({ tab }),
      onSelect: () => model.pageSend.send({ tab }),
    },
  ];
  return <ContextMenu label={MENU_LABEL} point={point} entries={entries} onClose={onClose} />;
};
