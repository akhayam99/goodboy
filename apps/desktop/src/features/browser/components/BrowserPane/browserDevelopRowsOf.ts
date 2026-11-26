import { Code, MonitorSmartphone, RefreshCw } from '@goodboy/ui/icons';
import type { MenuEntry } from '@goodboy/ui';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { currentPlatform } from '../../../../shared/platform';
import { DEVICE_PRESETS } from '../../devicePresets';
import type { BrowserPaneModel } from '../../types';
import type { BrowserMoreOff } from './browserMoreRows';
import { widthSelectOf } from './widthSelectOf';

type Params = {
  readonly model: BrowserPaneModel;
  readonly isOff: BrowserMoreOff;
};

const RELOAD_FROM_ORIGIN = 'Reload without cache';

export const browserDevelopRowsOf = ({
  model,
  isOff,
}: Params): ReadonlyArray<Extract<MenuEntry, { readonly kind: 'item' }>> => {
  const chooseWidth = widthSelectOf({ onChoose: model.setDevicePreset });
  return [
    {
      kind: 'item',
      key: 'reloadFromOrigin',
      label: RELOAD_FROM_ORIGIN,
      icon: RefreshCw,
      hint: shortcutGlyphs('app.reload'),
      isDisabled: isOff.isReloadFromOriginOff,
      onSelect: model.reloadFromOrigin,
    },
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
};
