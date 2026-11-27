import { Code, Database, MonitorSmartphone } from '@goodboy/ui/icons';
import type { MenuEntry } from '@goodboy/ui';
import { currentPlatform } from '../../../../shared/platform';
import { DEVICE_PRESETS } from '../../devicePresets';
import type { BrowserPaneModel } from '../../types';
import type { BrowserMoreOff } from './browserMoreRows';
import { widthSelectOf } from './widthSelectOf';

type Params = {
  readonly model: BrowserPaneModel;
  readonly isOff: BrowserMoreOff;
  readonly onShowSiteData: () => void;
};

const SHOW_SITE_DATA = 'Show site data';

export const browserDevelopRowsOf = ({
  model,
  isOff,
  onShowSiteData,
}: Params): ReadonlyArray<Extract<MenuEntry, { readonly kind: 'item' }>> => {
  const chooseWidth = widthSelectOf({ onChoose: model.setDevicePreset });
  return [
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
    ...(model.siteRecords.canList
      ? [
          {
            kind: 'item' as const,
            key: 'siteData',
            label: SHOW_SITE_DATA,
            icon: Database,
            onSelect: onShowSiteData,
          },
        ]
      : []),
  ];
};
