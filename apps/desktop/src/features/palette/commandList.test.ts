// @vitest-environment node
import { Inbox } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { buildCommandList } from './commandList';
import { EMPTY_FRECENCY } from './frecency';
import type { PaletteEntry } from './types';

const entry = (patch: Pick<PaletteEntry, 'key' | 'label' | 'kind'>): PaletteEntry => ({
  group: null,
  icon: Inbox,
  run: () => undefined,
  ...patch,
});

const ENTRIES: ReadonlyArray<PaletteEntry> = [
  entry({ key: 'help:guide', label: 'Guide', kind: 'help' }),
  entry({ key: 'action:toggle-theme', label: 'Switch to dark mode', kind: 'action' }),
  entry({ key: 'action:new-session', label: 'New session', kind: 'create' }),
  entry({ key: 'goto:inbox', label: 'Tasks', kind: 'goto' }),
  entry({ key: 'guide:commits', label: 'Guide: Commits', kind: 'page' }),
  entry({ key: 'action:pair-device', label: 'Pair an iPhone', kind: 'page' }),
];

const build = (query: string) =>
  buildCommandList({
    query,
    entries: ENTRIES,
    scopeVerbs: [],
    scopeTitle: null,
    scopeKey: null,
    parentVerbs: [],
    parentTitle: null,
    frecency: EMPTY_FRECENCY,
    now: 0,
  });

describe('buildCommandList at rest', () => {
  it('orders Go to, Create, App, Help whatever the entry order', () => {
    expect(build('').map((section) => section.title)).toEqual(['Go to', 'Create', 'App', 'Help']);
  });

  it('keeps a creation out of App and a help out of Go to', () => {
    const rows = (title: string) =>
      build('')
        .find((section) => section.title === title)
        ?.rows.map((row) => row.item.key);

    expect(rows('Create')).toEqual(['action:new-session']);
    expect(rows('App')).toEqual(['action:toggle-theme']);
    expect(rows('Help')).toEqual(['help:guide']);
  });

  it('lists Guide chapters and Pair an iPhone only once typed', () => {
    const atRest = build('').flatMap((section) => section.rows.map((row) => row.item.key));

    expect(atRest).not.toContain('guide:commits');
    expect(atRest).not.toContain('action:pair-device');
    expect(build('commits')[0]?.rows[0]?.item.key).toBe('guide:commits');
  });
});
