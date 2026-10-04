import { describe, expect, it, vi } from 'vitest';
import { NAMES } from '../../shared/names';
import type { SettingsGroup } from './components/SettingsStudio/settingsDirectory';
import { settingsPaletteEntries } from './settingsPaletteEntries';

const providersGroup: SettingsGroup = {
  scope: 'providers',
  label: 'Providers & models',
  concept: 'providers',
  place: 'Providers',
  subtitle: undefined,
  tone: undefined,
  needsWorkspace: false,
  pages: [
    {
      key: 'providers:defaults',
      label: NAMES.models,
      glyph: { kind: 'defaults' },
      tone: 'primary',
      attention: null,
      target: { scope: 'providers' },
    },
  ],
};

describe('settingsPaletteEntries', () => {
  it('finds the Models page when searching its former name Defaults', () => {
    const open = vi.fn();
    const [entry] = settingsPaletteEntries({ groups: [providersGroup], open });
    expect(entry?.label).toBe('Providers: Models');
    expect(entry?.secondary).toContain('Defaults');
    entry?.run();
    expect(open).toHaveBeenCalledWith({ scope: 'providers' });
  });
});
