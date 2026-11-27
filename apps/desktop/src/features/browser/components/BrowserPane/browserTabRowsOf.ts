import { Copy, CopyPlus, X } from '@goodboy/ui/icons';
import type { MenuEntry } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { BrowserPaneModel } from '../../types';
import type { BrowserMoreOff } from './browserMoreRows';

type Params = {
  readonly model: BrowserPaneModel;
  readonly isOff: BrowserMoreOff;
};

export const browserTabRowsOf = ({
  model,
  isOff,
}: Params): ReadonlyArray<Extract<MenuEntry, { readonly kind: 'item' }>> => [
  {
    kind: 'item',
    key: 'copyAddress',
    label: 'Copy address',
    icon: Copy,
    isDisabled: isOff.isCopyAddressOff,
    onSelect: model.copyAddress,
  },
  {
    kind: 'item',
    key: 'duplicate',
    label: 'Duplicate',
    icon: CopyPlus,
    isDisabled: isOff.isDuplicateOff,
    onSelect: model.duplicate,
  },
  {
    kind: 'item',
    key: 'openOutside',
    label: 'Open in your browser',
    icon: CONCEPT_ICONS.openExternal,
    isDisabled: isOff.isOpenOutsideOff,
    onSelect: model.openOutside,
  },
  {
    kind: 'item',
    key: 'closeTab',
    label: 'Close tab',
    icon: X,
    isDisabled: isOff.isCloseTabOff,
    onSelect: () => {
      if (model.shown !== null) {
        model.close({ tab: model.shown.tab });
      }
    },
  },
];
