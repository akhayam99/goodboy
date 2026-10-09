import { describe, expect, it, vi } from 'vitest';
import { NAMES } from '../../shared/names';
import type { SettingsGroup } from './components/SettingsStudio/settingsDirectory';
import { REVIEW_REPLIES_SECTION_ID } from '../resolve/replySettingsCopy';
import { workspacePageEntry } from './components/SettingsStudio/workspacePages';
import { settingsPaletteEntries } from './settingsPaletteEntries';

const providersGroup: SettingsGroup = {
  scope: 'providers',
  label: 'Providers & models',
  concept: 'providers',
  place: 'Providers',
  attention: undefined,
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

  it('opens the replies page under its new name and still answers to Review replies', () => {
    const open = vi.fn();
    const page = workspacePageEntry({ page: REVIEW_REPLIES_SECTION_ID });
    const workspaceGroup: SettingsGroup = {
      scope: 'workspace',
      label: 'Workspace',
      concept: 'workspace',
      place: 'Workspace',
      attention: undefined,
      tone: undefined,
      needsWorkspace: true,
      pages: [
        {
          key: `workspace:${page.id}`,
          label: page.label,
          glyph: { kind: 'concept', concept: page.concept },
          tone: 'primary',
          attention: null,
          target: { scope: 'workspace', section: page.id },
        },
      ],
    };
    const entry = settingsPaletteEntries({ groups: [workspaceGroup], open }).find(
      (candidate) => candidate.key === `setting:workspace:${page.id}`,
    );

    expect(entry?.label).toBe('Workspace settings: Replies and commits');
    expect(entry?.secondary).toContain('Review replies');
    entry?.run();
    expect(open).toHaveBeenCalledWith({ scope: 'workspace', section: 'review-replies' });
  });
});
