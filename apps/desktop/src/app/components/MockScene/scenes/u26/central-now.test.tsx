// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U26_CENTRAL_NOW_SCENES } from './central-now';

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
  const Scene = U26_CENTRAL_NOW_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown central now scene');
  }
  return render(<Scene />);
};

const sentenceOf = (): string => document.querySelector('[data-now-sentence]')?.textContent ?? '';

describe('central now scenes', () => {
  it('says the step of the run and what waits on you', () => {
    show({ name: 'u26-central-now-run-light' });
    expect(sentenceOf()).toBe(
      'Build is on step 3 of 6, Implement. Build step 4 waits on one answer from you.',
    );
    expect(document.querySelector('[data-now-state]')?.getAttribute('data-now-state')).toBe(
      'waiting',
    );
    screen.getByRole('img', {
      name: 'Step 3 of 6, Implement running, step 4 waits on you',
    });
  });

  it('says the orchestrator is deciding and draws the undecided next step', () => {
    show({ name: 'u26-central-now-orchestrated-dark' });
    expect(sentenceOf()).toBe('The orchestrator is deciding the next step.');
    screen.getByText('Next step, not decided yet');
  });

  it('is Stuck when a child of Auto never started', () => {
    show({ name: 'u26-central-now-auto-light' });
    expect(sentenceOf()).toBe('Auto is stuck: Implementer never started.');
    expect(document.querySelector('[data-now-state]')?.getAttribute('data-now-state')).toBe(
      'stuck',
    );
  });

  it('names a single working agent', () => {
    show({ name: 'u26-central-now-agent-light' });
    expect(sentenceOf()).toBe('Implementer is working on Add the limit table.');
  });

  it('shows the model name and the effort word of the agent, not the raw id', () => {
    show({ name: 'u26-central-now-agent-light' });
    const group = document.querySelector('[data-live-group="agent"]');
    expect(group?.textContent).toContain('High');
    expect(group?.textContent).not.toContain('claude-opus-5-5');
  });

  it('says the finished session from its request and checks', () => {
    show({ name: 'u26-central-now-finished-light' });
    expect(sentenceOf()).toBe('Checks passed on #309. Ready for review.');
  });

  it('lists two branches with their host nouns and no button', () => {
    show({ name: 'u26-central-now-branches-light' });
    const list = screen.getByRole('region', { name: 'Branches' });
    expect(list.textContent).toContain('ak/eng-1190-tenant-limits');
    expect(list.textContent).toContain('payments-api · #309');
    expect(list.textContent).toContain('ledger-core · !42');
    expect(document.querySelectorAll('[data-branch-row]')).toHaveLength(2);
    expect(document.querySelectorAll('button[data-variant]')).toHaveLength(0);
  });

  it('names the branch first, never only the folder', () => {
    show({ name: 'u26-central-now-branches-light' });
    const labels = [...document.querySelectorAll('[data-branch-row]')].map((row) =>
      row.getAttribute('aria-label'),
    );
    expect(labels.every((label) => label?.startsWith('ak/eng-1190-') === true)).toBe(true);
  });

  it('says when a stale read was checked and drops the checks word', () => {
    show({ name: 'u26-central-now-stale-light' });
    const row = document.querySelector('[data-branch-row]');
    expect(row?.textContent).toContain('checked 12m ago');
    expect(row?.textContent).not.toContain('Checks failing');
  });

  it('draws nine branches ranked by whose move, the merged one last', () => {
    show({ name: 'u26-central-now-story-light' });
    const rows = [...document.querySelectorAll('[data-branch-row]')];
    expect(rows).toHaveLength(9);
    expect(rows[0]?.textContent).toContain('Checks failing');
    expect(rows[0]?.textContent).toContain('in Next');
    expect(rows[8]?.textContent).toContain('Merged');
    expect(document.querySelector('[data-branch-fold]')).toBeNull();
    expect(document.querySelectorAll('button[data-variant]')).toHaveLength(0);
  });

  it('draws a track of seven dots per branch', () => {
    show({ name: 'u26-central-now-story-light' });
    const tracks = document.querySelectorAll('[data-branch-track]');
    expect(tracks).toHaveLength(9);
    expect(tracks[0]?.children).toHaveLength(7);
  });

  it('folds twenty branches to eight rows and one line that counts what it hides', () => {
    show({ name: 'u26-central-now-story-many-dark' });
    expect(document.querySelectorAll('[data-branch-row]')).toHaveLength(8);
    const fold = document.querySelector('[data-branch-fold]');
    expect(fold?.textContent).toMatch(/^12 more branches, \d+ merged$/);
    expect(fold?.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the fold to every branch and closes it again', () => {
    show({ name: 'u26-central-now-story-many-light' });
    const fold = screen.getByRole('button', { name: /more branches/ });
    fireEvent.click(fold);
    expect(document.querySelectorAll('[data-branch-row]')).toHaveLength(20);
    const closer = screen.getByRole('button', { name: 'Show fewer branches' });
    expect(closer.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(closer);
    expect(document.querySelectorAll('[data-branch-row]')).toHaveLength(8);
  });

  it('draws a dash where a step does not apply and names it on the row', () => {
    show({ name: 'u26-central-now-story-skipped-light' });
    const rows = [...document.querySelectorAll('[data-branch-row]')];
    expect(rows).toHaveLength(7);
    const rowOf = ({ branch }: { readonly branch: string }) =>
      rows.find((row) => row.getAttribute('aria-label')?.startsWith(`${branch},`) === true);
    const noCi = rowOf({ branch: 'ak/eng-1210-cache-warmup' });
    expect(noCi?.querySelector('[data-step="checks"]')?.getAttribute('data-step-state')).toBe(
      'skipped',
    );
    expect(noCi?.querySelector('[data-step="review"]')?.getAttribute('data-step-state')).toBe(
      'skipped',
    );
    expect(noCi?.getAttribute('aria-label')).toContain('Checks skipped, Review skipped.');
    const unread = rowOf({ branch: 'ak/eng-1214-retry-jitter' });
    expect(unread?.querySelector('[data-step="checks"]')?.getAttribute('data-step-state')).toBe(
      'todo',
    );
    expect(unread?.getAttribute('aria-label')).not.toContain('skipped');
  });

  it('shows Queued on the Merged step of a queued pull request', () => {
    show({ name: 'u26-central-now-story-skipped-dark' });
    const queued = [...document.querySelectorAll('[data-branch-row]')].find(
      (row) => row.getAttribute('aria-label')?.startsWith('ak/eng-1213-limit-export,') === true,
    );
    expect(queued?.textContent).toContain('Queued');
    expect(queued?.querySelector('[data-step="merged"]')?.getAttribute('data-step-state')).toBe(
      'current',
    );
  });

  it('registers each scene key', () => {
    expect(Object.keys(U26_CENTRAL_NOW_SCENES).sort()).toEqual([
      'u26-central-now-agent-dark',
      'u26-central-now-agent-light',
      'u26-central-now-auto-dark',
      'u26-central-now-auto-light',
      'u26-central-now-branches-dark',
      'u26-central-now-branches-light',
      'u26-central-now-finished-dark',
      'u26-central-now-finished-light',
      'u26-central-now-orchestrated-dark',
      'u26-central-now-orchestrated-light',
      'u26-central-now-run-dark',
      'u26-central-now-run-light',
      'u26-central-now-stale-light',
      'u26-central-now-story-dark',
      'u26-central-now-story-light',
      'u26-central-now-story-many-dark',
      'u26-central-now-story-many-light',
      'u26-central-now-story-skipped-dark',
      'u26-central-now-story-skipped-light',
    ]);
  });

  it.each(Object.keys(U26_CENTRAL_NOW_SCENES))(
    '%s has no accessibility violations',
    async (name) => {
      const { container } = show({ name });
      const { violations } = await runA11yCheck(container);
      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
