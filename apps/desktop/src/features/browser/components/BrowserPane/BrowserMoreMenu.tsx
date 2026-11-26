import {
  ArrowUpRight,
  Bot,
  Code,
  Copy,
  CopyPlus,
  MonitorSmartphone,
  RefreshCw,
  Trash2,
  X,
} from '@goodboy/ui/icons';
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
import { browserMoreOffOf } from './browserMoreRows';
import { siteDataRowOf } from './siteDataRowOf';
import { widthSelectOf } from './widthSelectOf';
import { DEVICE_PRESETS, devicePresetOf } from '../../devicePresets';
import { NAMES } from '../../../../shared/utils/names';

type Props = {
  readonly model: BrowserPaneModel;
  readonly folded?: ReadonlyArray<MenuItemEntry>;
  readonly onOpenAsPage?: () => void;
};

const MENU_LABEL = 'More';

const RELOAD_FROM_ORIGIN = 'Reload without cache';

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
    hasLivePage: model.shownLiveId !== null,
    hasSite: model.siteHost !== null,
    isPinShown: shown?.isPin === true,
    canOpenOutside: model.canOpenOutside,
  });
  const siteData = siteDataRowOf({
    host: model.siteHost,
    isWholeStore: currentPlatform() !== 'darwin',
  });
  const chooseWidth = widthSelectOf({ onChoose: model.setDevicePreset });
  const developChildren: ReadonlyArray<MenuItemEntry> = [
    ...(isOff.isWidthOff
      ? []
      : DEVICE_PRESETS.map((preset) => ({
          kind: 'item' as const,
          key: `width-${preset.id}`,
          label: preset.label,
          icon: MonitorSmartphone,
          isActive: preset.id === model.devicePreset,
          onSelect: () => chooseWidth(preset.id),
        }))),
    ...(currentPlatform() === 'darwin'
      ? [
          {
            kind: 'item' as const,
            key: 'inspect',
            label: 'Inspect in Safari',
            icon: Code,
            isDisabled: isOff.isInspectOff,
            onSelect: model.inspect,
          },
        ]
      : []),
  ];
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
      key: 'reloadFromOrigin',
      label: RELOAD_FROM_ORIGIN,
      icon: RefreshCw,
      hint: shortcutGlyphs('app.reload'),
      isDisabled: isOff.isReloadFromOriginOff,
      onSelect: model.reloadFromOrigin,
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
    ...(developChildren.length === 0
      ? []
      : [
          {
            kind: 'item' as const,
            key: 'develop',
            label: 'Develop',
            icon: Code,
            hint: isOff.isWidthOff ? null : devicePresetOf({ id: model.devicePreset }).label,
            children: developChildren,
            onSelect: () => undefined,
          },
        ]),
    {
      kind: 'item',
      key: 'closeTab',
      label: 'Close tab',
      icon: X,
      isDisabled: isOff.isCloseTabOff,
      onSelect: () => {
        if (shown !== null) {
          model.close({ tab: shown.tab });
        }
      },
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
