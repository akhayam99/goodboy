import { AppWindow, Bot, ChevronDown, Code, Pin, Trash2 } from '@goodboy/ui/icons';
import {
  AnchoredPopover,
  ICON_SIZE,
  MENU_MAX_WIDTH,
  MenuTriggerButton,
  POPOVER_WIDTH_CLASS,
  POPOVER_WIDTH_PX,
  useDropdown,
  type MenuEntry,
} from '@goodboy/ui';
import { useEffect } from 'react';
import { AppMenuList } from '../../../actions/AppMenuList';
import { actionIntentOf } from '../../../actions/actionIntentOf';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { currentPlatform } from '../../../../shared/platform';
import type { BrowserPaneModel } from '../../types';
import { browserDevelopRowsOf } from './browserDevelopRowsOf';
import { browserMenuTabsOf, type BrowserMenuTab } from './browserMenuTabsOf';
import { browserMoreOffOf } from './browserMoreRows';
import { browserTabRowsOf } from './browserTabRowsOf';
import { siteDataRowOf } from './siteDataRowOf';
import { SiteDataPanel } from './SiteDataPanel';
import { devicePresetOf } from '../../devicePresets';

type Props = {
  readonly model: BrowserPaneModel;
  readonly menuTabs: ReadonlyArray<BrowserMenuTab>;
};

const MENU_LABEL = 'Page menu';
const PANEL_LABEL = 'Site data';

export const BrowserMoreMenu = ({ model, menuTabs }: Props) => {
  const dropdown = useDropdown({
    width: 'min-w-[200px]',
    maxWidth: MENU_MAX_WIDTH,
    expectedHeight: 240,
    expectedWidth: 260,
  });
  const panel = useDropdown({
    width: POPOVER_WIDTH_CLASS.wide,
    expectedHeight: 320,
    expectedWidth: POPOVER_WIDTH_PX.wide,
  });
  const panelRef = panel.popupRef;
  const isPanelOpen = panel.open;
  useEffect(() => {
    if (isPanelOpen) {
      panelRef.current?.focus();
    }
  }, [isPanelOpen, panelRef]);
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
    extraHosts: model.siteTrail,
    isWholeStore: currentPlatform() !== 'darwin',
  });
  const tabs: ReadonlyArray<MenuEntry> =
    menuTabs.length === 0
      ? []
      : [
          {
            kind: 'group',
            key: 'tabs',
            label: 'Tabs',
            items: browserMenuTabsOf({ tabs: menuTabs }),
          },
          { kind: 'separator', key: 'tabs-end' },
        ];
  const projectName = model.projectName;
  const entries: ReadonlyArray<MenuEntry> = [
    ...tabs,
    {
      kind: 'item',
      key: 'sendToAgent',
      label: model.pageSend.isBusy ? 'Reading the page' : model.pageSend.label,
      icon: Bot,
      hint: shortcutGlyphs('browser.sendToAgent'),
      isDisabled: model.pageSend.isBusy || !model.pageSend.canSend,
      onSelect: model.pageSend.sendShown,
    },
    ...(shown === null || projectName === null
      ? []
      : [
          {
            kind: 'item' as const,
            key: 'pin',
            label: shown.isPin ? `Unpin from ${projectName}` : `Pin to ${projectName}`,
            icon: Pin,
            hint: shortcutGlyphs('browser.pin'),
            onSelect: model.togglePin,
          },
        ]),
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
    { kind: 'separator', key: 'page-end' },
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
      key: 'develop',
      label: 'Develop',
      icon: Code,
      hint: isOff.isWidthOff ? null : devicePresetOf({ id: model.devicePreset }).label,
      children: browserDevelopRowsOf({ model, isOff, onShowSiteData: panel.toggle }),
      onSelect: () => undefined,
    },
  ];

  return (
    <AnchoredPopover
      dropdown={panel}
      role="dialog"
      ariaLabel={PANEL_LABEL}
      tabIndex={-1}
      anchorClassName="shrink-0"
      trigger={
        <AnchoredPopover
          dropdown={dropdown}
          trigger={
            <MenuTriggerButton
              label={MENU_LABEL}
              tooltip={MENU_LABEL}
              isOpen={dropdown.open}
              size="compact"
              onClick={() => {
                panel.close();
                dropdown.toggle();
              }}
            >
              <ChevronDown size={ICON_SIZE.row} aria-hidden />
            </MenuTriggerButton>
          }
        >
          <AppMenuList label={MENU_LABEL} entries={entries} onClose={dropdown.close} />
        </AnchoredPopover>
      }
    >
      {model.siteRecords.canList ? (
        <SiteDataPanel siteRecords={model.siteRecords} readKey={model.shownLiveId} />
      ) : null}
    </AnchoredPopover>
  );
};
