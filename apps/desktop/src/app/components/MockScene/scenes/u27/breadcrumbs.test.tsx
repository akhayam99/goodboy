// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { sessionTitle } from '../../../../../features/session/sessionTitle';
import { MOCK_SCENES } from '../..';
import { U27_BREADCRUMBS_SCENES } from './breadcrumbs';
import { BREADCRUMB_PLACES, type BreadcrumbPlaceId } from './breadcrumbs/breadcrumbPlaces';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

type MountParams = {
  readonly id: string;
};

const mount = ({ id }: MountParams) => {
  const Scene = U27_BREADCRUMBS_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('breadcrumbs scenes', () => {
  it('registers a light and a dark after scene per place', () => {
    for (const [name, Scene] of Object.entries(U27_BREADCRUMBS_SCENES)) {
      expect(MOCK_SCENES[name]).toBe(Scene);
    }
    expect(Object.keys(U27_BREADCRUMBS_SCENES)).toHaveLength(10);
  });

  it.each<readonly [string, BreadcrumbPlaceId, ReadonlyArray<string>]>([
    ['run', 'run', ['Orchestrated', 'Run']],
    ['step', 'step', ['Orchestrated', 'Run', 'Agent']],
    ['agent', 'agent', ['Agents', 'Agent']],
    ['artifact', 'artifact', ['Artifacts', 'Artifact']],
    ['branch-file', 'branchFile', ['Branch', 'File']],
  ])('draws the real session trail on the %s page', async (slug, placeId, tail) => {
    mount({ id: `u27-breadcrumbs-after-${slug}-light` });
    const session = BREADCRUMB_PLACES[placeId].session;
    const trail = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    const labels = [...trail.querySelectorAll('[data-trail-piece]')].map(
      (piece) => piece.textContent ?? '',
    );

    expect(labels).toEqual([sessionTitle({ session }), ...tail]);
    expect(
      within(trail)
        .getByText(tail.at(-1) ?? '')
        .getAttribute('aria-current'),
    ).toBe('page');
  });
});
