// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules']);
const ALLOWED = new Set([
  'app/components/GoodboyChip/BrandLockup.tsx',
  'app/components/BootSplash/BootBrand.tsx',
  'shared/components/BrandTile.tsx',
]);
const BRAND_TILE_FILE = 'shared/components/BrandTile.tsx';
const BRAND_TILE_IMPORTERS = new Set([
  'features/onboarding/OnboardingWizard/steps/WelcomeStep.tsx',
  'features/onboarding/OnboardingWizard/WizardHeader.tsx',
  'features/workspace/components/WorkspaceLauncher/index.tsx',
]);
const SCENE_FIXTURES = 'app/components/MockScene/';

const listSourceFiles = ({ dir }: { readonly dir: string }): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((entry) => {
    if (SKIP_SEGMENTS.has(entry)) {
      return [];
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return listSourceFiles({ dir: full });
    }
    if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) {
      return [];
    }
    return [full];
  });

const sourcePaths = (): ReadonlyArray<{ readonly path: string; readonly text: string }> =>
  listSourceFiles({ dir: SRC }).map((file) => ({
    path: relative(SRC, file).split(sep).join('/'),
    text: readFileSync(file, 'utf8'),
  }));

describe('DogMascot', () => {
  it('marks the brand only: the brand lockup, the boot splash and the brand tile', () => {
    const users = sourcePaths()
      .filter(({ text }) => text.includes('DogMascot'))
      .map(({ path }) => path)
      .sort();

    expect(users.filter((file) => !ALLOWED.has(file))).toEqual([]);
    expect(users).toEqual([...ALLOWED].sort());
  });

  it('lets only the welcome step, the setup header and the launcher draw the brand tile', () => {
    const importers = sourcePaths()
      .filter(
        ({ path, text }) =>
          path !== BRAND_TILE_FILE &&
          !path.startsWith(SCENE_FIXTURES) &&
          /\bBrandTile\b/.test(text),
      )
      .map(({ path }) => path)
      .sort();

    expect(importers.filter((path) => !BRAND_TILE_IMPORTERS.has(path))).toEqual([]);
  });
});
