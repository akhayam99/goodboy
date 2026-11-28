// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { MenuEntry, MenuItemEntry } from '@goodboy/ui';
import { MOUNT_ROW_STATES } from '../../../__tests__/helpers/rowMenuStates';
import { mountRowMenuOf } from '../../session/mountRowMenuOf';
import { visibleActionsOf } from '../components/ObjectOverflowMenu/visibleActionsOf';
import { resolveActions } from '../resolveActions';
import { toMenuEntries } from '../toMenuEntries';
import type { ActionEnv } from '../types';
import type { MountFacts } from './mountFacts';
import { MOUNT_KIND } from './mount';

type StateParams = {
  readonly state: string;
};

type FactsParams = {
  readonly facts: MountFacts;
};

type LabelParams = {
  readonly entries: ReadonlyArray<MenuEntry>;
  readonly label: string;
};

const env: ActionEnv = {
  getState: () => {
    throw new Error('not used');
  },
  showToast: () => undefined,
  copyText: async () => undefined,
  origin: 'overflow',
  anchorKey: null,
  viewing: null,
};

const factsOf = ({ state }: StateParams): MountFacts => {
  const found = MOUNT_ROW_STATES.find(([name]) => name === state)?.[1];
  if (found === undefined) {
    throw new Error(`no mount state ${state}`);
  }
  return found;
};

const overflowOf = ({ facts }: FactsParams): ReadonlyArray<MenuEntry> => {
  const actions = resolveActions({ definitions: MOUNT_KIND.actions, facts });
  return toMenuEntries({
    actions: visibleActionsOf({
      actions,
      omit: [],
      only: null,
      relabel: null,
      onlyOf: mountRowMenuOf,
    }),
    env,
    run: vi.fn(async () => undefined),
    pool: actions,
  });
};

const rightClickOf = ({ facts }: FactsParams): ReadonlyArray<MenuEntry> =>
  toMenuEntries({
    actions: resolveActions({ definitions: MOUNT_KIND.actions, facts }),
    env,
    run: vi.fn(async () => undefined),
  });

const labelsOf = ({ entries }: Omit<LabelParams, 'label'>): ReadonlyArray<string> =>
  entries.flatMap((entry) => (entry.kind === 'item' ? [entry.label] : []));

const itemOf = ({ entries, label }: LabelParams): MenuItemEntry => {
  const found = entries.find(
    (entry): entry is MenuItemEntry => entry.kind === 'item' && entry.label === label,
  );
  if (found === undefined) {
    throw new Error(`no row ${label}`);
  }
  return found;
};

describe('the branch row ⋯ is an explicit list per state', () => {
  it('open: the pull request, Open, Switch branch, Copy and Close branch', () => {
    expect(
      labelsOf({ entries: overflowOf({ facts: factsOf({ state: 'PR open, 3 to resolve' }) }) }),
    ).toEqual(['Open PR #318', 'Open', 'Switch branch…', 'Copy', 'Close branch']);
  });

  it('merged: the pull request, Open, Copy and one verb, Delete local branch', () => {
    const entries = overflowOf({ facts: factsOf({ state: 'Merged' }) });

    expect(labelsOf({ entries })).toEqual(['Open PR #318', 'Open', 'Copy', 'Delete local branch…']);
    expect(itemOf({ entries, label: 'Copy' }).children?.map((child) => child.label)).toEqual([
      'Branch name',
      'Path',
    ]);
  });

  it('closed: Reopen, Copy and Unmount', () => {
    expect(
      labelsOf({
        entries: overflowOf({ facts: factsOf({ state: 'Worktree closed, files kept' }) }),
      }),
    ).toEqual(['Reopen', 'Copy', 'Unmount']);
  });

  it('never shows Close branch beside Delete local branch on a merged branch, even on right click', () => {
    const labels = labelsOf({ entries: rightClickOf({ facts: factsOf({ state: 'Merged' }) }) });

    expect(labels).toContain('Delete local branch…');
    expect(labels).not.toContain('Close branch');
    expect(labels).not.toContain('Clean up');
  });
});

describe('Delete local branch', () => {
  it('confirms with what goes and stays, and offers Close branch instead', () => {
    const entries = overflowOf({ facts: factsOf({ state: 'Merged' }) });
    const confirm = itemOf({ entries, label: 'Delete local branch…' }).confirm;

    expect(confirm?.description).toBe(
      'Its folder goes too. Your after-merge setting decides about the branch on origin.',
    );
    expect(confirm?.confirmLabel).toBe('Delete local branch');
    expect(confirm?.alt?.label).toBe('Close branch');
    expect(confirm?.notes).toEqual(['Close branch keeps the local branch and removes the folder.']);
  });

  it('counts the files that are not committed', () => {
    const facts = { ...factsOf({ state: 'Merged' }), dirty: 3 };
    const confirm = itemOf({
      entries: overflowOf({ facts }),
      label: 'Delete local branch…',
    }).confirm;

    expect(confirm?.notes?.[0]).toBe(
      '3 files are not committed in its folder. Delete stops and keeps them.',
    );
  });

  it('says Closing… while Close branch works', () => {
    const close = resolveActions({
      definitions: MOUNT_KIND.actions,
      facts: factsOf({ state: 'PR open, 3 to resolve' }),
    }).find((action) => action.id === 'mount.close');

    expect(close?.pendingLabel).toBe('Closing…');
  });
});

describe('the Merge order row', () => {
  it('sits in the row menu with its count while another branch shares a file', () => {
    const open = factsOf({ state: 'PR open, 3 to resolve' });

    expect(labelsOf({ entries: overflowOf({ facts: open }) })).not.toContain('Merge order (2)');
    expect(labelsOf({ entries: overflowOf({ facts: { ...open, overlapCount: 2 } }) })).toContain(
      'Merge order (2)',
    );
  });

  it('stays away from a merged or closed branch', () => {
    for (const state of ['Merged', 'Worktree closed, files kept']) {
      const facts = { ...factsOf({ state }), overlapCount: 2 };

      expect(labelsOf({ entries: overflowOf({ facts }) })).not.toContain('Merge order (2)');
    }
  });
});
