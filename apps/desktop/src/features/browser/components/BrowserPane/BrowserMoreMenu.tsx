import { ArrowUpRight, Bot, Code, Copy, CopyPlus, MonitorSmartphone, X } from 'lucide-react';
import {
  AnchoredPopover,
  ICON_SIZE,
  MENU_MAX_WIDTH,
  MenuTriggerButton,
  useDropdown,
  type MenuEntry,
} from '@goodboy/ui';
import { AppMenuList } from '../../../actions/AppMenuList';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { currentPlatform } from '../../../../shared/platform';
import type { BrowserPaneModel } from '../../types';
import { browserMoreOffOf } from './browserMoreRows';
import { widthSelectOf } from './widthSelectOf';
import { DEVICE_PRESETS, devicePresetOf } from '../../devicePresets';

type Props = {
  readonly model: BrowserPaneModel;
  readonly onOpenAsPage?: () => void;
};

const MENU_LABEL = 'More';

export const BrowserMoreMenu = ({ model, onOpenAsPage }: Props) => {
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
    isPinShown: shown?.isPin === true,
    canOpenOutside: model.canOpenOutside,
  });
  const entries: ReadonlyArray<MenuEntry> = [
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
            label: 'Open as page',
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
    ...(isOff.isWidthOff
      ? []
      : [
          {
            kind: 'item' as const,
            key: 'width',
            label: 'Width',
            icon: MonitorSmartphone,
            hint: devicePresetOf({ id: model.devicePreset }).label,
            choices: DEVICE_PRESETS.map((preset) => ({
              id: preset.id,
              label: preset.label,
              isCurrent: preset.id === model.devicePreset,
            })),
            onSelect: widthSelectOf({ onChoose: model.setDevicePreset }),
          },
        ]),
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
