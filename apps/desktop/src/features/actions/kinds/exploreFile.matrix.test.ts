// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { matrixOf } from '../../../__tests__/helpers/actionMatrix';
import { resolveActions } from '../resolveActions';
import { EXPLORE_FILE_KIND, type ExploreFileFacts } from './exploreFile';

const noop = () => undefined;

const facts = (overrides: Partial<ExploreFileFacts>): ExploreFileFacts => ({
  name: 'rounding.ts',
  relPath: 'apps/ledger-core/rounding.ts',
  absolutePath: '/work/settlement/apps/ledger-core/rounding.ts',
  isDir: false,
  openLabel: 'Open in editor',
  editorLabel: 'VS Code',
  onAsk: noop,
  onOpen: noop,
  onReveal: noop,
  ...overrides,
});

const STATES: ReadonlyArray<{
  readonly name: string;
  readonly facts: ExploreFileFacts;
  readonly expected: ReadonlyArray<string>;
}> = [
  {
    name: 'a code file in a repository with an editor',
    facts: facts({}),
    expected: [
      'exploreFile.openInEditor hover',
      'exploreFile.reveal hover',
      'exploreFile.ask hover',
      'exploreFile.copyPath menu',
    ],
  },
  {
    name: 'a file the default app opens',
    facts: facts({ name: 'spec.pdf', openLabel: 'Open', editorLabel: null }),
    expected: [
      'exploreFile.openInEditor hover',
      'exploreFile.reveal hover',
      'exploreFile.ask hover',
      'exploreFile.copyPath menu',
    ],
  },
  {
    name: 'a folder in a repository with an editor',
    facts: facts({ name: 'apps', relPath: 'apps', isDir: true }),
    expected: [
      'exploreFile.openInEditor hover',
      'exploreFile.reveal hover',
      'exploreFile.copyPath menu',
    ],
  },
  {
    name: 'a folder with no editor to open it in',
    facts: facts({
      name: 'apps',
      relPath: 'apps',
      isDir: true,
      openLabel: null,
      editorLabel: null,
    }),
    expected: ['exploreFile.reveal hover', 'exploreFile.copyPath menu'],
  },
  {
    name: 'a row with no handlers wired',
    facts: facts({ onAsk: null, onOpen: null, onReveal: null }),
    expected: ['exploreFile.copyPath menu'],
  },
];

describe('exploreFile action matrix', () => {
  it.each(STATES)('$name', ({ facts: given, expected }) => {
    expect(matrixOf({ definitions: EXPLORE_FILE_KIND.actions, facts: given })).toEqual(expected);
  });

  it('never offers Ask on a folder, whatever the handlers', () => {
    const folder = facts({ isDir: true, onAsk: noop });
    const ids = resolveActions({ definitions: EXPLORE_FILE_KIND.actions, facts: folder }).map(
      (action) => action.id,
    );
    expect(ids).not.toContain('exploreFile.ask');
  });

  it('labels Open after where it goes', () => {
    const labelOf = (given: ExploreFileFacts) =>
      resolveActions({ definitions: EXPLORE_FILE_KIND.actions, facts: given }).find(
        (action) => action.id === 'exploreFile.openInEditor',
      );
    expect(labelOf(facts({}))?.label).toBe('Open in editor');
    expect(labelOf(facts({}))?.description).toBe('Open in VS Code');
    expect(labelOf(facts({ openLabel: 'Open', editorLabel: null }))?.label).toBe('Open');
    expect(labelOf(facts({ openLabel: 'Open', editorLabel: null }))?.description).toBe(
      'Open with the default app',
    );
  });

  it('keeps every verb in the Open, Act, Copy order', () => {
    const groups = resolveActions({ definitions: EXPLORE_FILE_KIND.actions, facts: facts({}) }).map(
      (action) => action.group,
    );
    expect(groups).toEqual(['open', 'open', 'act', 'copy']);
  });
});
