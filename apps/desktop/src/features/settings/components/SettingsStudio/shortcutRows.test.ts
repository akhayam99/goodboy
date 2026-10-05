// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SHORTCUTS } from '../../../../shared/keyboard/registry';
import { SHORTCUT_COLUMNS, SHORTCUT_ROW_COUNT, groupWhere, shortcutRows } from './shortcutRows';

describe('shortcutRows', () => {
  it('folds the nine workspace digits into one row after the switcher', () => {
    expect(shortcutRows({ group: 'workspaces' })).toEqual([
      {
        key: 'workspace.switcher',
        label: 'Switch workspace',
        first: 'workspace.switcher',
        last: 'workspace.switcher',
        where: 'With a workspace open',
      },
      {
        key: 'workspace-digit',
        label: 'Go to workspace 1 to 9',
        first: 'workspace.1',
        last: 'workspace.9',
        where: null,
      },
    ]);
  });

  it('keeps the integration digits as named rows, since each opens a different lens', () => {
    const labels = shortcutRows({ group: 'views' }).map((row) => row.label);

    expect(labels).toContain('Pull request');
    expect(labels).toContain('Linear');
    expect(labels).toContain('Slack threads');
  });

  it('lists the diff keys under their own group', () => {
    expect(shortcutRows({ group: 'diff' }).map((row) => row.first)).toEqual([
      'diff.previousFile',
      'diff.nextFile',
      'diff.focusFilter',
    ]);
  });

  it('puts the list keys on their own group with one shared place', () => {
    expect(shortcutRows({ group: 'lists' }).map((row) => row.first)).toEqual([
      'list.next',
      'list.previous',
      'list.open',
      'list.openInTool',
      'list.reply',
      'list.star',
      'list.dismiss',
      'list.search',
    ]);
    expect(groupWhere({ group: 'lists' })).toBe('In the Inbox and Notifications lists');
  });

  it('lists the selection keys under their own group with one shared place', () => {
    expect(shortcutRows({ group: 'selection' }).map((row) => row.first)).toEqual([
      'selection.toggle',
      'selection.all',
      'selection.clear',
      'selection.delete',
    ]);
    expect(groupWhere({ group: 'selection' })).toBe('In a list with checkboxes');
  });

  it('says where a conditional key works, on its row', () => {
    const rows = shortcutRows({ group: 'session' });

    expect(rows.find((row) => row.first === 'terminal.newTab')?.where).toBe('In the terminal');
    expect(rows.find((row) => row.first === 'session.model')?.where).toBe(
      'Where a chat composer is open',
    );
    expect(rows.find((row) => row.first === 'session.archive')?.where).toBeNull();
    expect(groupWhere({ group: 'session' })).toBeNull();
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
