// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { TelemetryRecord } from '@goodboy/types';
import { importStore, resetStoryStore, type StoryStore } from '../../../../../store/storyHarness';
import {
  SESSION_ID,
  seedActivityRunScene,
} from '../../../../../app/components/MockScene/scenes/activityRunSeed';
import { NAMES } from '../../../../../shared/utils/names';
import { ROLE_LABEL } from '../../../agent-kind';
import { contextWindowFor } from '../../../contextWindowFor';
import { SendsSection } from '.';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

const LIVE_AGENT = 'Add the stuck-delivery banner';
const SETTLED_AGENT = 'Read the support copy for stuck deliveries';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
});

beforeEach(async () => {
  await resetStoryStore();
  seedActivityRunScene();
});

afterEach(() => {
  cleanup();
});

type FillParams = {
  readonly contextTokens: number;
};

const reportContext = ({ contextTokens }: FillParams): TelemetryRecord => {
  const records = store.getState().sessionTelemetry[SESSION_ID] ?? [];
  const live = records.find((record) => record.id === 'mock-run-telemetry-console');
  if (live === undefined) {
    throw new Error('The seed has no live turn');
  }
  const next = { ...live, contextTokens };
  store.setState({
    sessionTelemetry: {
      [SESSION_ID]: records.map((record) => (record.id === live.id ? next : record)),
    },
  });
  return next;
};

const mount = () => render(<SendsSection sessionId={SESSION_ID} />);

const sendsCard = () => screen.getByRole('region', { name: NAMES.whatGoodboySends });

describe('What Goodboy sends', () => {
  it('lists each role with the parts it receives and their weight', async () => {
    mount();

    const card = await screen.findByRole('region', { name: NAMES.whatGoodboySends });
    const planner = card.querySelector<HTMLElement>('[data-send-row="planner"]');
    if (planner === null) {
      throw new Error('No planner row');
    }
    within(planner).getByText(ROLE_LABEL.planner);
    const parts = [...planner.querySelectorAll('[data-send-part]')].map((part) =>
      part.getAttribute('data-send-part'),
    );
    expect(parts).toEqual(['goal', 'decisions', 'open_questions', 'last_output_summary']);
    within(planner).getByText(/^\d+(\.\d+k)? tokens$/);
    within(card).getByText(/^Up to [\d.]+k tokens a turn$/);
  });

  it('keeps the scout and docs agents off the decisions', async () => {
    mount();

    const card = await screen.findByRole('region', { name: NAMES.whatGoodboySends });
    const scout = card.querySelector('[data-send-row="scout|docs"]');
    expect(scout?.querySelector('[data-send-part="decisions"]')).toBeNull();
  });

  it('states the Ask budget for live work', async () => {
    mount();

    const card = await screen.findByRole('region', { name: NAMES.whatGoodboySends });
    const ask = card.querySelector<HTMLElement>('[data-send-row="ask"]');
    if (ask === null) {
      throw new Error('No Ask row');
    }
    within(ask).getByText('Up to 4.0k tokens');
  });

  it('shows how full the context window of each running agent is', async () => {
    const record = reportContext({ contextTokens: 52_000 });
    const window = contextWindowFor(record.model);
    if (window === null) {
      throw new Error(`No context window for ${record.model}`);
    }
    mount();

    const meter = await screen.findByRole('meter', { name: `${LIVE_AGENT} context window` });
    expect(meter.getAttribute('aria-valuenow')).toBe(String(Math.round((52_000 / window) * 100)));
    expect(within(sendsCard()).queryByText(SETTLED_AGENT)).toBeNull();
  });

  it('says the size is not reported yet before the first turn reports it', async () => {
    mount();

    const card = await screen.findByRole('region', { name: NAMES.whatGoodboySends });
    const row = card.querySelector<HTMLElement>(`[data-agent-fill="${LIVE_AGENT}"]`);
    if (row === null) {
      throw new Error('No fill row');
    }
    within(row).getByText('Not reported yet');
  });

  it('drops the fill rows when no agent is running', async () => {
    store.setState({ agentTurnState: {} });
    const runs = store.getState().sessionPhaseRuns[SESSION_ID] ?? [];
    store.setState({
      sessionPhaseRuns: {
        [SESSION_ID]: runs.map((agent) =>
          agent.status === 'running' ? { ...agent, status: 'completed' } : agent,
        ),
      },
    });
    mount();

    const card = await screen.findByRole('region', { name: NAMES.whatGoodboySends });
    expect(within(card).queryByText(NAMES.contextWindow)).toBeNull();
    expect(within(card).queryByRole('meter')).toBeNull();
  });
});
