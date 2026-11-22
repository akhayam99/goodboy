// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  brandId,
  type IsoDateTime,
  type ProviderId,
  type TelemetryRecord,
  type TelemetryRecordId,
} from '@goodboy/types';
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

type SwitchParams = {
  readonly provider: ProviderId;
};

const switchProvider = ({ provider }: SwitchParams) => {
  const runs = store.getState().sessionPhaseRuns[SESSION_ID] ?? [];
  store.setState({
    sessionPhaseRuns: {
      [SESSION_ID]: runs.map((agent) =>
        agent.name === LIVE_AGENT
          ? { ...agent, providerOverride: provider, providerSessionProviderId: provider }
          : agent,
      ),
    },
  });
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

  it('marks the role rows as defaults and shows the Lead children reading only the goal', async () => {
    mount();

    const card = await screen.findByRole('region', { name: NAMES.whatGoodboySends });
    within(card).getByText('Default for each role');
    const child = card.querySelector<HTMLElement>('[data-send-row="lead-child"]');
    if (child === null) {
      throw new Error('No Lead children row');
    }
    within(child).getByText(`${NAMES.lead} children`);
    within(child).getByText('Agents the Lead starts read only their brief');
    const parts = [...child.querySelectorAll('[data-send-part]')].map((part) =>
      part.getAttribute('data-send-part'),
    );
    expect(parts).toEqual(['goal']);
  });

  it('shows the active provider after a switch, not an older fuller one', async () => {
    const current = reportContext({ contextTokens: 20_000 });
    const window = contextWindowFor(current.model);
    if (window === null) {
      throw new Error(`No context window for ${current.model}`);
    }
    const records = store.getState().sessionTelemetry[SESSION_ID] ?? [];
    store.setState({
      sessionTelemetry: {
        [SESSION_ID]: [
          ...records,
          {
            ...current,
            id: brandId<TelemetryRecordId>({ value: 'harborline-old-provider' }),
            provider: 'anthropic',
            contextTokens: 150_000,
            recordedAt: brandId<IsoDateTime>({ value: '2026-01-01T00:00:00.000Z' }),
          },
        ],
      },
    });
    switchProvider({ provider: 'cursor' });
    mount();

    const meter = await screen.findByRole('meter', { name: `${LIVE_AGENT} context window` });
    expect(meter.getAttribute('aria-valuenow')).toBe(String(Math.round((20_000 / window) * 100)));
  });

  it('says not reported yet when the new provider has not reported usage', async () => {
    reportContext({ contextTokens: 150_000 });
    switchProvider({ provider: 'codex' });
    mount();

    const card = await screen.findByRole('region', { name: NAMES.whatGoodboySends });
    const row = card.querySelector<HTMLElement>(`[data-agent-fill="${LIVE_AGENT}"]`);
    if (row === null) {
      throw new Error('No fill row');
    }
    within(row).getByText('Not reported yet');
    expect(within(row).queryByRole('meter')).toBeNull();
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
