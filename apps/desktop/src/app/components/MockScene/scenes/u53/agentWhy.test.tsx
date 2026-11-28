// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import type { ComponentType } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { RUN_LEAD_AGENT_SCENES } from '../surfaces/run-page/run-lead-agent';
import { U53_AGENT_WHY_SCENES } from './agentWhy';

const SETTLE_MS = 2_000;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

type MountParams = {
  readonly Scene: ComponentType;
};

const mountBrief = async ({ Scene }: MountParams): Promise<HTMLElement> => {
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return screen.getByRole('region', { name: 'Why the Lead started it' });
};

describe('an agent names its provider, model and why', () => {
  it("names Codex, the step size and the Lead's words, and lists the candidates it weighed", async () => {
    const brief = await mountBrief({ Scene: U53_AGENT_WHY_SCENES['u53-agent-lead-pick'] });

    within(brief).getByText('Codex');
    within(brief).getByText('· Standard step');
    within(brief).getByText('Why the Lead chose Codex:', { exact: false });
    within(brief).getByText(/Claude is at 62%, so I keep it for the review/);
    expect(within(brief).queryByRole('list', { name: 'Candidates it weighed' })).toBeNull();

    fireEvent.click(within(brief).getByRole('button', { name: 'Candidates it weighed' }));

    const rows = within(
      within(brief).getByRole('list', { name: 'Candidates it weighed' }),
    ).getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    const pick = rows.find((row) => row.getAttribute('aria-current') === 'true');
    expect(pick?.textContent).toContain(
      'Codex is #3 in your order · 18% used · 2 agents in the last hour',
    );
    const struck = rows.filter((row) => row.hasAttribute('data-candidate-struck'));
    expect(struck.map((row) => row.textContent)).toEqual([
      expect.stringContaining(
        'the Lead cannot stop Cursor from pushing on its own yet, so it gives Cursor only read-only jobs',
      ),
    ]);
  });

  it("says why the pick changed, with the Lead's own line under it", async () => {
    const brief = await mountBrief({ Scene: U53_AGENT_WHY_SCENES['u53-agent-moved-pick'] });

    within(brief).getByText('Claude');
    within(brief).getByText('Why Claude:', { exact: false });
    within(brief).getByText(
      /The Lead asked for Cursor Sonnet 5.5: the Lead cannot stop Cursor from pushing/,
    );
    within(brief).getByText('The Lead said: "Cursor has room and Sonnet fits a standard test."');
    expect(within(brief).queryByText(/used Sonnet 5.5/)).toBeNull();

    fireEvent.click(within(brief).getByRole('button', { name: 'Candidates it weighed' }));
    within(brief).getByText(
      /asked by the Lead · the Lead cannot stop Cursor from pushing on its own yet, so it gives Cursor only read-only jobs/,
    );
  });

  it('keeps the line of an older delegation, with no why and no candidates', async () => {
    const brief = await mountBrief({ Scene: RUN_LEAD_AGENT_SCENES['run-page-lead-agent'] });

    within(brief).getByText('Claude');
    expect(brief.querySelector('[data-routing-why]')).toBeNull();
    expect(within(brief).queryByRole('button', { name: 'Candidates it weighed' })).toBeNull();
  });
});
