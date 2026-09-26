import { describe, expect, it } from 'vitest';
import { SHORTCUTS } from '../../../../shared/keyboard/registry';
import { SHORTCUT_COLUMNS, SHORTCUT_ROW_COUNT, shortcutRows } from './shortcutRows';

describe('shortcutRows', () => {
  it('folds the nine workspace digits into one row after the switcher', () => {
    expect(shortcutRows({ group: 'workspaces' })).toEqual([
      {
        key: 'workspace.switcher',
        label: 'Switch workspace',
        first: 'workspace.switcher',
        last: 'workspace.switcher',
      },
      {
        key: 'workspace-digit',
        label: 'Go to workspace 1 to 9',
        first: 'workspace.1',
        last: 'workspace.9',
      },
    ]);
  });

  it('keeps the integration digits as named rows, since each opens a different lens', () => {
    const labels = shortcutRows({ group: 'views' }).map((row) => row.label);

    expect(labels).toContain('Pull request');
    expect(labels).toContain('Linear');
    expect(labels).toContain('Slack threads');
  });

  it('lays every group out exactly once across the columns', () => {
    const groups = SHORTCUT_COLUMNS.flat();
    const registered = new Set(Object.values(SHORTCUTS).map((entry) => entry.group));

    expect(new Set(groups).size).toBe(groups.length);
    expect(new Set(groups)).toEqual(registered);
  });

  it('counts the rows the page renders, not the registry entries', () => {
    expect(SHORTCUT_ROW_COUNT).toBe(Object.keys(SHORTCUTS).length - 8);
  });
});
