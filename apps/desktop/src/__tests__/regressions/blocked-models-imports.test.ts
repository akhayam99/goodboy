// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  desktopSources,
  importsInSources,
  importsOf,
  isTestSource,
  type SourceImport,
} from '../helpers/sourceImports';

const HIDDEN_ONLY = 'store/slices/settings/selectHiddenModels';
const ALLOWED_FROM: ReadonlySet<string> = new Set([
  'store/slices/providers/selectBlockedModels.ts',
]);

const isHiddenOnlyRead = ({ from, target }: SourceImport): boolean =>
  target === HIDDEN_ONLY && !ALLOWED_FROM.has(from) && !isTestSource(from);

const violations = (): ReadonlyArray<string> =>
  importsInSources(desktopSources())
    .filter(isHiddenOnlyRead)
    .map(({ from }) => from);

describe('routing reads the models it must avoid through one selector', () => {
  it('recognises an import of the hidden list alone', () => {
    const text = [
      "import { selectHiddenModels } from '../settings/selectHiddenModels';",
      "import { selectBlockedModels } from '../providers/selectBlockedModels';",
    ].join('\n');
    const found = importsOf({ path: 'store/slices/turn/pickTurn.ts', text }).filter(
      isHiddenOnlyRead,
    );

    expect(found.map(({ target }) => target)).toEqual([HIDDEN_ONLY]);
  });

  it('scans the sources and finds the one selector that merges the refusals', () => {
    const imports = importsInSources(desktopSources());

    expect(
      imports.some(({ from, target }) => ALLOWED_FROM.has(from) && target === HIDDEN_ONLY),
    ).toBe(true);
  });

  it('has no routing code reading the hidden models without the refused ones', () => {
    expect(
      violations(),
      'Use selectBlockedModels (store/slices/providers/selectBlockedModels.ts): it holds the hidden models and the ones this account refused.',
    ).toEqual([]);
  });
});
