// @vitest-environment node
import { Inbox } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import type { ActionGroup, ResolvedAction } from '../actions/types';
import { buildCommandList, flattenRows } from './commandList';
import { EMPTY_FRECENCY } from './frecency';
import { rankSessionVerbs, type PaletteTier } from './paletteTiers';
import type { PaletteEntry } from './types';

type VerbParams = {
  readonly id: string;
  readonly label: string;
  readonly group: ActionGroup;
};

const verb = ({ id, label, group }: VerbParams): PaletteEntry => ({
  key: `verb:${id}`,
  label,
  kind: 'verb',
  group: null,
  icon: Inbox,
  run: () => undefined,
  action: {
    id,
    label,
    shortLabel: label,
    ariaLabel: null,
    icon: Inbox,
    iconClassName: null,
    group,
    slot: 'menu',
    pendingLabel: null,
    doneLabel: null,
    shortcut: null,
    preview: null,
    description: null,
    blockedReason: null,
    confirm: null,
    isUndoable: false,
    choices: null,
    isBusy: false,
  } satisfies ResolvedAction,
});

const VERBS: ReadonlyArray<PaletteEntry> = [
  verb({ id: 'agent.message', label: 'Message this agent', group: 'act' }),
  verb({ id: 'agent.rename', label: 'Rename', group: 'act' }),
  verb({ id: 'agent.delete', label: 'Delete agent...', group: 'danger' }),
  verb({ id: 'session.rename', label: 'Rename session', group: 'act' }),
  verb({ id: 'session.delete', label: 'Delete session...', group: 'danger' }),
];

const TIERS: ReadonlyArray<PaletteTier> = ['archived', 'needs', 'live', 'ship', 'finished', 'idle'];

type DefaultListParams = {
  readonly isScopeSession: boolean;
};

const defaultList = ({ isScopeSession }: DefaultListParams) =>
  flattenRows(
    buildCommandList({
      query: '',
      entries: [],
      scopeVerbs: VERBS,
      scopeTitle: 'For this agent',
      scopeKey: 'agent:a-1',
      parentVerbs: VERBS,
      parentTitle: 'For this session',
      frecency: EMPTY_FRECENCY,
      now: 0,
      tier: 'live',
      isScopeSession,
    }),
  ).map((row) => row.item);

describe('a default palette list', () => {
  it('holds no Danger verb at an agent scope', () => {
    const list = defaultList({ isScopeSession: false });

    expect(list.length).toBeGreaterThan(0);
    expect(list.filter((item) => item.action?.group === 'danger')).toEqual([]);
  });

  it('holds no Danger verb at a session scope', () => {
    const list = defaultList({ isScopeSession: true });

    expect(list.length).toBeGreaterThan(0);
    expect(list.filter((item) => item.action?.group === 'danger')).toEqual([]);
  });

  it.each(TIERS)('ranks no Danger verb in the %s tier', (tier) => {
    expect(
      rankSessionVerbs({ tier, verbs: VERBS }).filter((item) => item.action?.group === 'danger'),
    ).toEqual([]);
  });

  it('still finds a Danger verb by typing its name', () => {
    const rows = flattenRows(
      buildCommandList({
        query: 'delete',
        entries: [],
        scopeVerbs: VERBS,
        scopeTitle: 'For this agent',
        scopeKey: 'agent:a-1',
        parentVerbs: [],
        parentTitle: null,
        frecency: EMPTY_FRECENCY,
        now: 0,
      }),
    );

    expect(rows.map((row) => row.item.label)).toContain('Delete agent...');
  });
});
