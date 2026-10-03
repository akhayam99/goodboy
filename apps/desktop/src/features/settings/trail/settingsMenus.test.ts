import { describe, expect, it, vi } from 'vitest';
import { settingsTrail } from './settingsMenus';

describe('settingsTrail', () => {
  it('offers no reset action, since Settings has no project scope to reset', () => {
    const segments = settingsTrail({
      scope: 'app',
      appSection: 'general',
      workspacePage: 'projects',
      workspaceName: 'Harborline',
      onSelect: vi.fn(),
    });

    expect(segments.map((segment) => segment.id)).toEqual(['settings', 'scope', 'section']);
    expect(segments.flatMap((segment) => segment.menu?.actions ?? [])).toEqual([]);
    expect(
      segments
        .find((segment) => segment.id === 'scope')
        ?.menu?.groups.flatMap((group) => group.rows.map((row) => row.id)),
    ).toEqual(['app', 'workspace', 'providers', 'tools']);
  });
});

describe('settingsTrail first segment', () => {
  it('turns Settings into a button that goes back to the home from any page', () => {
    const onSelect = vi.fn();
    const pages = ['app', 'workspace', 'providers', 'tools'] as const;

    pages.forEach((scope) => {
      const [first] = settingsTrail({
        scope,
        appSection: 'general',
        workspacePage: 'projects',
        workspaceName: 'Harborline',
        onSelect,
      });
      first?.onSelect?.();
    });

    expect(onSelect).toHaveBeenCalledTimes(pages.length);
    expect(onSelect.mock.calls.every(([change]) => change.scope === 'home')).toBe(true);
  });

  it('shows only Settings on the home', () => {
    const segments = settingsTrail({
      scope: 'home',
      appSection: 'general',
      workspacePage: 'projects',
      workspaceName: null,
      onSelect: vi.fn(),
    });

    expect(segments.map((segment) => segment.id)).toEqual(['settings']);
  });
});

describe('settingsTrail workspace pages', () => {
  it('names the workspace page and switches between pages from its menu', () => {
    const onSelect = vi.fn();
    const segments = settingsTrail({
      scope: 'workspace',
      appSection: 'general',
      workspacePage: 'review-replies',
      workspaceName: 'Harborline',
      onSelect,
    });
    const page = segments.find((segment) => segment.id === 'section');
    const rows = page?.menu?.groups.flatMap((group) => group.rows) ?? [];

    expect(page?.label).toBe('Review replies');
    expect(rows.find((row) => row.isCurrent)?.label).toBe('Review replies');
    rows.find((row) => row.id === 'permissions')?.onSelect();
    expect(onSelect).toHaveBeenCalledWith({ scope: 'workspace', section: 'permissions' });
  });
});
