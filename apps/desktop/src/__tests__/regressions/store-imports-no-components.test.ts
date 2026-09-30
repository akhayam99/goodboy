// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  desktopSources,
  importsInSources,
  importsOf,
  type SourceImport,
} from '../helpers/sourceImports';

const UI_LAYER = /^(?:features\/[^/]+\/(?:components|hooks)|app)(?:\/|$)/;

const isStoreToUi = ({ from, target }: SourceImport): boolean =>
  from.startsWith('store/') && UI_LAYER.test(target);

const violations = (): ReadonlyArray<string> =>
  importsInSources(desktopSources().filter((path) => path.startsWith('store/')))
    .filter(isStoreToUi)
    .map(({ from, target }) => `${from} -> ${target}`);

describe('the store imports no component, hook or shell code', () => {
  it('scans the store sources, never an empty sweep', () => {
    const sources = desktopSources().filter((path) => path.startsWith('store/'));

    expect(sources).toContain('store/store.ts');
    expect(sources.some((path) => path.startsWith('store/slices/'))).toBe(true);
    expect(importsInSources(sources).length).toBeGreaterThan(100);
  });

  it('recognises a store import of a component, a hook or the shell', () => {
    const text = [
      "import { A } from '../../../features/session/components/Pane/parts';",
      "import { B } from '../../../features/session/hooks/useThing/cache';",
      "import { C } from '../../../app/components/Toast';",
      `${['vi', 'mock'].join('.')}('../../../app/hooks/useAppOverlays', () => ({}));`,
      "import { D } from '../../../features/session/agent-kind';",
      "import { E } from '../../../shared/lib/db';",
    ].join('\n');
    const found = importsOf({ path: 'store/slices/demo/index.ts', text }).filter(isStoreToUi);

    expect(found.map(({ target }) => target)).toEqual([
      'features/session/components/Pane/parts',
      'features/session/hooks/useThing/cache',
      'app/components/Toast',
      'app/hooks/useAppOverlays',
    ]);
  });

  it('has no store file, test or mock reaching into the UI layer', () => {
    expect(violations()).toEqual([]);
  });
});
