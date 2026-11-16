// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { IconGlyph } from '@goodboy/ui/icons';
import { findGlyph } from '@goodboy/ui/icons/testing/findGlyph';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U26_ACTIVITY_KINDS_SCENES } from './activity-kinds';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});
afterEach(() => {
  cleanup();
});

type Params = { readonly name: string };
const show = ({ name }: Params) => {
  const Scene = U26_ACTIVITY_KINDS_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown activity kinds scene');
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

type DrawsParams = {
  readonly icon: IconGlyph;
};

const runGlyphDraws = ({ icon }: DrawsParams): boolean =>
  screen.getAllByTestId('run-glyph').some((glyph) => findGlyph({ root: glyph, icon }) !== null);

describe('activity kinds scenes', () => {
  it('draws a preset run with the Workflows glyph and an orchestrated run with the orchestrator', () => {
    show({ name: 'activity-kinds-light' });
    expect(runGlyphDraws({ icon: CONCEPT_ICONS.workflows })).toBe(true);
    expect(runGlyphDraws({ icon: CONCEPT_ICONS.orchestrator })).toBe(true);
    expect(screen.getAllByRole('img', { name: /preset run/i }).length).toBeGreaterThan(0);
  });
  it('registers a light and a dark shot', () => {
    expect(Object.keys(U26_ACTIVITY_KINDS_SCENES)).toEqual([
      'activity-kinds-light',
      'activity-kinds-dark',
    ]);
  });
  it.each(Object.keys(U26_ACTIVITY_KINDS_SCENES))(
    '%s has no accessibility violations',
    async (name) => {
      const { container } = show({ name });
      const { violations } = await runA11yCheck(container);
      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
