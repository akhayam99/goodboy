// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type TelemetryRecord,
  type TelemetryRecordId,
} from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { FIXTURE_ROOT, FIXTURE_SESSION, aView } from '../../../auto/testing/autoViewFixtures';
import { AgentRunSettings } from './AgentRunSettings';

const SCOUT = brandId<AgentId>({ value: 'agent-scout-ledger-core' });
const LEAD_RUN = brandId<ProviderRunId>({ value: 'run-lead' });
const SCOUT_RUN = brandId<ProviderRunId>({ value: 'run-scout' });

const SESSION = aSession({ id: FIXTURE_SESSION });
const LEAD = anAgent({
  id: FIXTURE_ROOT,
  sessionId: FIXTURE_SESSION,
  name: 'Lead',
  runId: LEAD_RUN,
});
const HELPER = anAgent({
  id: SCOUT,
  sessionId: FIXTURE_SESSION,
  name: 'Scout',
  runId: SCOUT_RUN,
  parentAgentId: FIXTURE_ROOT,
});

type SpendParams = {
  readonly leadUsd: number;
  readonly scoutUsd: number;
};

type RecordParams = {
  readonly runId: ProviderRunId;
  readonly costUsd: number;
};

const recordOf = ({ runId, costUsd }: RecordParams): TelemetryRecord => ({
  id: brandId<TelemetryRecordId>({ value: `telemetry-${runId}` }),
  runId,
  sessionId: FIXTURE_SESSION,
  kind: 'turn',
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  inputTokens: 12_000,
  outputTokens: 900,
  estimatedCostUsd: costUsd,
  recordedAt: brandId<IsoDateTime>({ value: '2026-11-27T09:00:00.000Z' }),
});

let useAppStore: StoryStore;

const spendOnRun = ({ leadUsd, scoutUsd }: SpendParams) => {
  useAppStore.setState({
    sessionTelemetry: {
      [FIXTURE_SESSION]: [
        recordOf({ runId: LEAD_RUN, costUsd: leadUsd }),
        recordOf({ runId: SCOUT_RUN, costUsd: scoutUsd }),
      ],
    },
  });
};

const mountLeadHeader = () =>
  render(
    <AgentRunSettings
      session={SESSION}
      agent={LEAD}
      autoView={{ ...aView({ delegations: [] }), budget: null }}
      asksSlotRef={() => undefined}
    />,
  );

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ sessionPhaseRuns: { [FIXTURE_SESSION]: [LEAD, HELPER] } });
});

afterEach(cleanup);

describe('the share of the Lead on its page', () => {
  it('says a share above a quarter on a run above half a dollar', () => {
    spendOnRun({ leadUsd: 0.82, scoutUsd: 1.18 });
    mountLeadHeader();

    screen.getByText('Run total $2.00');
    screen.getByText('Lead used 41% of this run');
  });

  it('keeps the plain share on a tiny run', () => {
    spendOnRun({ leadUsd: 0.2, scoutUsd: 0.2 });
    mountLeadHeader();

    screen.getByText('Lead share 50%');
    expect(screen.queryByText(/Lead used/)).toBeNull();
  });

  it('follows the run as helpers spend', () => {
    spendOnRun({ leadUsd: 0.82, scoutUsd: 1.18 });
    mountLeadHeader();

    act(() => spendOnRun({ leadUsd: 0.82, scoutUsd: 4.18 }));

    screen.getByText('Lead share 16%');
    expect(screen.queryByText(/Lead used/)).toBeNull();
  });
});
