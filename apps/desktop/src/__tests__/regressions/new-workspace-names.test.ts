// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { NAMES, formerNamesOf } from '../../shared/names';
import {
  DESKTOP_SRC,
  desktopSources,
  importsInSources,
  isTestSource,
} from '../helpers/sourceImports';

const FORM = 'shared/components/NewWorkspaceForm';

const WIZARD_STEPS = 'features/onboarding/OnboardingWizard/steps/';

const SCENES = 'app/components/MockScene/';

const LABELLED_DOORS: ReadonlyArray<string> = [
  'features/workspace/components/WorkspaceLauncher/index.tsx',
  'features/workspace/components/WorkspaceLauncher/LauncherEmpty.tsx',
  'features/workspace/components/WorkspaceSwitcher/index.tsx',
  'features/workspace/components/WorkspaceLinkStudio/index.tsx',
  'features/palette/hooks/useCommandEntries.ts',
];

const FORM_HOSTS: ReadonlyArray<string> = [
  'features/workspace/components/StageBoard/index.tsx',
  'features/workspace/components/WorkspaceLauncher/index.tsx',
  'features/workspace/components/WorkspaceLinkStudio/index.tsx',
  'shared/components/ProjectLinkList/index.tsx',
];

const RETIRED_LABELS: ReadonlyArray<RegExp> = [
  /['">]\s*Start a new project\b/,
  /['">]\s*Open a folder\s*['"<]/,
  /['">]\s*Open a workspace\s*['"<]/,
  /['">]\s*Add workspace\s*['"<]/,
  /['">]\s*Add a workspace\s*['"<]/,
  /['">]\s*New project\??\s*['"<{]/,
  /['">]\s*Link a repository\s*['"<]/,
  /['">]\s*Manage projects\s*['"<]/,
  /\blinked projects?\b/,
];

const NAME_OWNERS: ReadonlySet<string> = new Set(['shared/names.ts']);

const sourceOf = (path: string): string => readFileSync(join(DESKTOP_SRC, path), 'utf8');

const productSources = (): ReadonlyArray<string> =>
  desktopSources().filter((path) => !isTestSource(path));

describe('every door to a new workspace says New workspace', () => {
  it('names the one entry New workspace and keeps the old words as former names', () => {
    expect(NAMES.newWorkspace).toBe('New workspace');
    expect(formerNamesOf(NAMES.newWorkspace)).toEqual(
      expect.arrayContaining(['Open a folder', 'Start a new project']),
    );
  });

  it.each(LABELLED_DOORS)('%s labels its door from NAMES.newWorkspace', (path) => {
    expect(sourceOf(path)).toContain('NAMES.newWorkspace');
  });

  it('keeps no retired door label in product code, outside the former names', () => {
    const hits = productSources()
      .filter((path) => !NAME_OWNERS.has(path))
      .flatMap((path) => {
        const source = sourceOf(path);
        return RETIRED_LABELS.filter((label) => label.test(source)).map(
          (label) => `${path} ${label.source}`,
        );
      });

    expect(hits).toEqual([]);
  });

  it('opens New workspace with one event, and starts no project apart', () => {
    const hits = productSources().filter((path) =>
      sourceOf(path).includes('goodboy:start-new-project'),
    );

    expect(hits).toEqual([]);
  });
});

describe('every door opens the one form', () => {
  const importers = (): ReadonlyArray<string> =>
    [
      ...new Set(
        importsInSources(productSources())
          .filter(({ target }) => target === FORM || target === `${FORM}/index`)
          .map(({ from }) => from),
      ),
    ].sort();

  it('mounts the form from its hosts, one wizard step and the scenes only', () => {
    const hosts = importers().filter(
      (path) => !path.startsWith(SCENES) && !path.startsWith(WIZARD_STEPS),
    );

    expect(hosts).toEqual([...FORM_HOSTS].sort());
  });

  it('mounts it from exactly one wizard step', () => {
    expect(importers().filter((path) => path.startsWith(WIZARD_STEPS))).toHaveLength(1);
  });
});
