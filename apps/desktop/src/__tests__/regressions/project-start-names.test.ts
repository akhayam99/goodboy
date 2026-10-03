// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');

const START = 'Start a new project';
const OPEN = 'Open a folder';

const PAIRED_SURFACES: ReadonlyArray<string> = [
  'app/components/AppEmptyState.tsx',
  'features/onboarding/OnboardingWizard/steps/ProjectStep.tsx',
  'features/workspace/components/WorkspaceLauncher/index.tsx',
  'features/workspace/components/WorkspaceSwitcher/index.tsx',
  'features/workspace/components/WorkspaceLinkForm/index.tsx',
  'features/palette/hooks/useCommandEntries.ts',
];

const SETTINGS_SURFACES: ReadonlyArray<string> = [
  'shared/components/ProjectLinkList/ProjectAddPopover.tsx',
  'shared/components/ProjectLinkList/ProjectLinkAddRow.tsx',
];

const RETIRED_LABELS: ReadonlyArray<RegExp> = [
  /['">]\s*Choose a folder\s*['"<]/,
  /['">]\s*Add a workspace\s*['"<]/,
  /['">]\s*New project\s*['"<]/,
];

const sourceOf = (path: string): string => readFileSync(join(SRC, path), 'utf8');

describe('starting a project says the same words everywhere', () => {
  it.each(PAIRED_SURFACES)('%s offers Start a new project first, then Open a folder', (path) => {
    const source = sourceOf(path);
    const start = source.indexOf(START);
    const open = source.indexOf(OPEN);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(open).toBeGreaterThan(start);
  });

  it.each(SETTINGS_SURFACES)('%s names the new project flow Start a new project', (path) => {
    expect(sourceOf(path)).toContain(START);
  });

  it.each([...PAIRED_SURFACES, ...SETTINGS_SURFACES])('%s keeps no retired label', (path) => {
    const source = sourceOf(path);

    for (const label of RETIRED_LABELS) {
      expect(source).not.toMatch(label);
    }
  });
});
