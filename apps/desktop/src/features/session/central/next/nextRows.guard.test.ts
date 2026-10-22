import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

import { centralNextCards } from '../../../../app/components/MockScene/scenes/u26/centralNextSeed';
import { centralNowSeedOf } from '../../../../app/components/MockScene/scenes/u26/centralNowSeed';
import { NEXT_LIST_BUILT_SOURCES } from '../../../../app/components/MockScene/scenes/u27/nextList/nextListBuiltSources';
import { NEXT_LIST_SOURCES } from '../../../../app/components/MockScene/scenes/u27/nextList/nextListSources';
import { actionCardsOf, type ActionCardModel } from './actionCardsOf';
import { nextGroupsOf } from './nextGroupsOf';
import { nextSubjectOf } from './nextSubjectOf';

type Seed = Readonly<{
  name: string;
  cards: ReadonlyArray<ActionCardModel>;
}>;

const NOW_VARIANTS = [
  'run',
  'orchestrated',
  'auto',
  'agent',
  'branches',
  'stale',
  'story',
  'story-many',
  'story-skipped',
  'story-one-project',
  'finished',
] as const;

const SEEDS: ReadonlyArray<Seed> = [
  ...(['mid', 'stuck', 'done'] as const).map((moment) => ({
    name: `u26 central next ${moment}`,
    cards: centralNextCards({ moment }),
  })),
  ...NOW_VARIANTS.flatMap((variant) => {
    const seed = centralNowSeedOf({ variant });
    return [
      { name: `u26 central now ${variant}`, cards: seed.cards },
      { name: `u26 central now ${variant} branches`, cards: seed.branchCards },
    ];
  }),
  { name: 'u27 next list before', cards: actionCardsOf(NEXT_LIST_SOURCES) },
  { name: 'u27 next list built', cards: actionCardsOf(NEXT_LIST_BUILT_SOURCES) },
];

const COVERED = new Set([
  'u26/centralNextSeed.ts',
  'u26/centralNowSeed.ts',
  'u26/centralStorySeed.ts',
  'u27/nextList/nextListSources.ts',
  'u27/nextList/nextListBuiltSources.ts',
]);

const SHOWN_ELSEWHERE = new Set([
  'u21/states.tsx',
  'u27/nextList/NextListScene.tsx',
  'u27/nextList/NextListBeforeView.tsx',
  'u27/nextList/nextListBeforeActionsFor.ts',
  'u27/nextList/nextListBeforeCards.ts',
]);

const SCENES_DIR = join(import.meta.dirname, '../../../../app/components/MockScene/scenes');

const SCENE_SOURCES: ReadonlyArray<readonly [string, string]> = readdirSync(SCENES_DIR, {
  recursive: true,
  encoding: 'utf8',
})
  .filter((path) => path.endsWith('.ts') || path.endsWith('.tsx'))
  .map((path) => [path.split(sep).join('/'), readFileSync(join(SCENES_DIR, path), 'utf8')]);

const NEXT_TYPES = /\b(?:ActionCardModel|AutoActionTarget|NeedsYouOwner)\b/;

type DuplicateParams = {
  readonly cards: ReadonlyArray<ActionCardModel>;
};

const duplicatesOf = ({ cards }: DuplicateParams): ReadonlyArray<string> =>
  nextGroupsOf({ cards, seen: [] }).flatMap((group) => {
    const seen = new Set<string>();
    return group.rows.flatMap((row) => {
      const key = `${group.id} ${nextSubjectOf({ card: row }).key}`;
      if (seen.has(key)) {
        return [key];
      }
      seen.add(key);
      return [];
    });
  });

describe('Next rows on every scene seed', () => {
  it.each(SEEDS)('$name shows each subject once per group', ({ cards }) => {
    expect(duplicatesOf({ cards })).toEqual([]);
  });

  it('walks every scene file that builds Next cards', () => {
    const files = SCENE_SOURCES.filter(
      ([path, text]) => !path.includes('.test.') && NEXT_TYPES.test(text),
    ).map(([path]) => path);

    expect(files.filter((file) => !COVERED.has(file) && !SHOWN_ELSEWHERE.has(file))).toEqual([]);
    expect(files).toEqual(expect.arrayContaining([...COVERED]));
    expect(SEEDS.length).toBeGreaterThan(20);
  });
});
