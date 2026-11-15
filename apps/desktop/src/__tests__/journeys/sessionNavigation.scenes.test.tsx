// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { escapeLadder } from '../../features/session/escapeLadder';
import { installSceneJourney } from './sceneJourney';

const journey = installSceneJourney();

describe('journey: session tabs, crumbs, the back button and Esc', () => {
  it('goes from a run up to Runs and across the tabs, the crumbs and the tab strip never shown together', async () => {
    await journey.mount({ name: 'u27-breadcrumbs-after-run-light' });

    expect(journey.crumbsOf()).toEqual(['Overview', 'Runs', 'Duplicate credit fix']);
    expect(journey.tabsOf()).toEqual([]);
    expect(journey.partOf({ selector: '[data-session-head]' }).getAttribute('data-head-nav')).toBe(
      'crumbs',
    );
    expect(journey.view().target?.kind).toBe('run');

    await journey.clickButton({ name: 'Back to Runs' });

    expect(journey.view().target).toBeNull();
    expect(journey.view().lens).toBe('workflows');
    expect(journey.partOf({ selector: '[data-session-head]' }).getAttribute('data-head-nav')).toBe(
      'tabs',
    );
    expect(journey.tabsOf()).toEqual(['Overview', 'Runs', 'Artifacts', 'Questions', 'Context']);
    expect(journey.selectedTabOf()).toBe('Runs');
    expect(journey.crumbsOf()).toEqual([]);

    await journey.clickTab({ name: /^Context/ });
    expect(journey.view().lens).toBe('context');
    expect(journey.selectedTabOf()).toBe('Context');

    await journey.clickTab({ name: /^Overview/ });
    expect(journey.view().lens).toBeNull();
    expect(journey.selectedTabOf()).toBe('Overview');
  });

  it('goes up one crumb on Esc, from the run to Runs, and stays on a tab page', async () => {
    await journey.mount({ name: 'u27-breadcrumbs-after-run-light' });
    expect(journey.view().target?.kind).toBe('run');

    act(() => escapeLadder({}));
    await journey.settle();

    expect(journey.view().target).toBeNull();
    expect(journey.view().lens).toBe('workflows');

    act(() => escapeLadder({}));
    await journey.settle();

    expect(journey.view().lens).toBe('workflows');
    expect(journey.selectedTabOf()).toBe('Runs');
  });

  it('opens a crumb as a link: the Runs crumb of a run lands on the Runs tab', async () => {
    await journey.mount({ name: 'u27-breadcrumbs-after-run-light' });

    await journey.clickButton({ name: 'Runs' });

    expect(journey.view().lens).toBe('workflows');
    expect(journey.view().target).toBeNull();
    expect(journey.selectedTabOf()).toBe('Runs');
  });

  it('has no Changes tab on a session with more than one branch', async () => {
    await journey.mount({ name: 'ux39-p10-session' });

    expect(journey.tabsOf()).toEqual(['Overview', 'Runs', 'Artifacts', 'Questions', 'Context']);
    expect(screen.queryByRole('tab', { name: /Changes/ })).toBeNull();
  });

  it('opens the artifact page under a crumb row with Artifacts as its parent', async () => {
    await journey.mount({ name: 'u27-breadcrumbs-after-artifact-light' });

    expect(journey.crumbsOf()[0]).toBe('Overview');
    expect(journey.crumbsOf()[1]).toBe('Artifacts');
    expect(journey.view().target?.kind).toBe('artifact');

    await journey.clickButton({ name: 'Back to Artifacts' });

    expect(journey.view().target).toBeNull();
    expect(journey.selectedTabOf()).toBe('Artifacts');
  });
});
