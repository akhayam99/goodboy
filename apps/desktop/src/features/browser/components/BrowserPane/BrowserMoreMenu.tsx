import { AppWindow, ArrowUpRight, Bot, Code, Trash2 } from '@goodboy/ui/icons';
import {
  AnchoredPopover,
  ICON_SIZE,
  MENU_MAX_WIDTH,
  MenuTriggerButton,
  useDropdown,
  type MenuEntry,
  type MenuItemEntry,
} from '@goodboy/ui';
import { AppMenuList } from '../../../actions/AppMenuList';
import { actionIntentOf } from '../../../actions/actionIntentOf';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { currentPlatform } from '../../../../shared/platform';
import type { BrowserPaneModel } from '../../types';
import { browserDevelopRowsOf } from './browserDevelopRowsOf';
import { browserMoreOffOf } from './browserMoreRows';
import { browserTabRowsOf } from './browserTabRowsOf';
import { siteDataRowOf } from './siteDataRowOf';
import { devicePresetOf } from '../../devicePresets';
import { NAMES } from '../../../../shared/utils/names';

type Props = {
  readonly model: BrowserPaneModel;
  readonly folded?: ReadonlyArray<MenuItemEntry>;
  readonly onOpenAsPage?: () => void;
};

const MENU_LABEL = 'More';

const NOTHING_FOLDED: ReadonlyArray<MenuItemEntry> = [];

export const BrowserMoreMenu = ({ model, folded = NOTHING_FOLDED, onOpenAsPage }: Props) => {
  const dropdown = useDropdown({
    width: 'min-w-[200px]',
    maxWidth: MENU_MAX_WIDTH,
    expectedHeight: 280,
    expectedWidth: 220,
  });
  const shown = model.shown;
  const isOff = browserMoreOffOf({
    hasAddress: model.address !== '',
    hasTab: shown !== null,
    hasView: model.hasShownView,
    hasSite: model.siteHost !== null,
    isPinShown: shown?.isPin === true,
    canOpenOutside: model.canOpenOutside,
  });
  const siteData = siteDataRowOf({
    host: model.siteHost,
    isWholeStore: currentPlatform() !== 'darwin',
  });
  const entries: ReadonlyArray<MenuEntry> = [
    ...folded,
    {
      kind: 'item',
      key: 'sendToAgent',
      label: model.pageSend.isBusy ? 'Reading the page' : model.pageSend.label,
      icon: Bot,
      hint: shortcutGlyphs('browser.sendToAgent'),
      isDisabled: model.pageSend.isBusy || !model.pageSend.canSend,
      onSelect: model.pageSend.sendShown,
    },
    {
      kind: 'item',
      key: 'openOutside',
      label: 'Open in your browser',
      icon: CONCEPT_ICONS.openExternal,
      isDisabled: isOff.isOpenOutsideOff,
      onSelect: model.openOutside,
    },
    ...(onOpenAsPage === undefined
      ? []
      : [
          {
            kind: 'item' as const,
            key: 'openAsPage',
            label: NAMES.openFullPage,
            icon: ArrowUpRight,
            onSelect: onOpenAsPage,
          },
        ]),
    {
      kind: 'item',
      key: 'thisTab',
      label: 'This tab',
      icon: AppWindow,
      children: browserTabRowsOf({ model, isOff }),
      onSelect: () => undefined,
    },
    {
      kind: 'item',
      key: 'clearSiteData',
      label: siteData.label,
      icon: Trash2,
      isDestructive: actionIntentOf({ verb: siteData.label }) === 'destructive',
      isDisabled: isOff.isClearSiteDataOff,
      confirm: siteData.confirm,
      onSelect: model.clearSiteData,
    },
    {
      kind: 'item',
      key: 'develop',
      label: 'Develop',
      icon: Code,
      hint: isOff.isWidthOff ? null : devicePresetOf({ id: model.devicePreset }).label,
      children: browserDevelopRowsOf({ model, isOff }),
      onSelect: () => undefined,
    },
  ];

  return (
    <AnchoredPopover
      dropdown={dropdown}
      anchorClassName="shrink-0"
      trigger={
        <MenuTriggerButton
          label={MENU_LABEL}
          tooltip="More"
          isOpen={dropdown.open}
          size="control"
          onClick={dropdown.toggle}
        >
          <CONCEPT_ICONS.more size={ICON_SIZE.control} aria-hidden />
        </MenuTriggerButton>
      }
    >
      <AppMenuList label={MENU_LABEL} entries={entries} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
