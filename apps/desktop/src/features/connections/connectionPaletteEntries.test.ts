// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { EMPTY_FRECENCY } from '../palette/frecency';
import { rankCandidates } from '../palette/rank';
import type { PaletteEntry } from '../palette/types';
import type { ProviderDisplayInfo } from '../providers/providers';
import { connectionPaletteEntries } from './connectionPaletteEntries';

const PROVIDERS: ReadonlyArray<Pick<ProviderDisplayInfo, 'id'>> = [
  { id: 'codex' },
  { id: 'anthropic' },
];

type LabelsParams = {
  readonly entries: ReadonlyArray<PaletteEntry>;
  readonly query: string;
};

const labelsFor = ({ entries, query }: LabelsParams): ReadonlyArray<string> =>
  rankCandidates({ items: entries, query, frecency: EMPTY_FRECENCY, now: 0 })
    .map((ranked) => ranked.item.label)
    .sort();

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('connectionPaletteEntries', () => {
  it('lists every provider and integration by its own name with its kind as the tag', () => {
    const entries = connectionPaletteEntries({ providers: PROVIDERS, hasWorkspace: true });

    expect(entries.map((entry) => [entry.label, entry.tag])).toEqual([
      ['Claude', 'Provider'],
      ['Codex', 'Provider'],
      ['GitHub', 'Integration'],
      ['GitLab', 'Integration'],
      ['Bitbucket', 'Integration'],
      ['Linear', 'Integration'],
      ['Jira', 'Integration'],
      ['Sentry', 'Integration'],
      ['Slack', 'Integration'],
    ]);
    expect(entries.some((entry) => /^(Providers|Integrations):/.test(entry.label))).toBe(false);
  });

  it('answers the old group names Providers and Integrations', () => {
    const entries = connectionPaletteEntries({ providers: PROVIDERS, hasWorkspace: true });

    expect(labelsFor({ entries, query: 'providers' })).toEqual(['Claude', 'Codex']);
    expect(labelsFor({ entries, query: 'integrations' })).toEqual([
      'Bitbucket',
      'GitHub',
      'GitLab',
      'Jira',
      'Linear',
      'Sentry',
      'Slack',
    ]);
  });

  it('opens the page of the row picked in Connections', () => {
    const entries = connectionPaletteEntries({ providers: PROVIDERS, hasWorkspace: true });

    entries.find((entry) => entry.label === 'Codex')?.run();
    expect(useAppStore.getState().appStudio).toEqual({
      kind: 'connections',
      focus: { kind: 'provider', provider: 'codex' },
    });

    entries.find((entry) => entry.label === 'Slack')?.run();
    expect(useAppStore.getState().appStudio).toEqual({
      kind: 'connections',
      focus: { kind: 'tool', tool: 'slack' },
    });
  });

  it('leaves integrations out when no workspace is open', () => {
    const entries = connectionPaletteEntries({ providers: PROVIDERS, hasWorkspace: false });

    expect(entries.map((entry) => entry.tag)).toEqual(['Provider', 'Provider']);
  });
});
