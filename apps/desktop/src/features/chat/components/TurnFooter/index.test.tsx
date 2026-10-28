// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
  type TelemetryRecord,
  type TelemetryRecordId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import type { TranscriptItem } from '../../utils/transcript-items';
import { NAMES } from '../../../../shared/utils/names';
import { TurnFooter } from './index';

const SESSION_ID = brandId<SessionId>({ value: 'session-1' });
const AGENT_ID = brandId<AgentId>({ value: 'agent-1' });
const RUN_ID = brandId<ProviderRunId>({ value: 'run-1' });
const ENDED_AT = brandId<IsoDateTime>({ value: '2026-06-08T10:00:42.000Z' });
const STARTED_AT = brandId<IsoDateTime>({ value: '2026-06-08T10:00:00.000Z' });

const RECORD: TelemetryRecord = {
  id: brandId<TelemetryRecordId>({ value: 'rec-1' }),
  runId: RUN_ID,
  sessionId: SESSION_ID,
  kind: 'turn',
  provider: 'anthropic',
  model: 'claude-opus-5',
  inputTokens: 100000,
  outputTokens: 1400,
  cachedInputTokens: 90000,
  cacheCreationInputTokens: 2000,
  contextTokens: 76000,
  estimatedCostUsd: 0.12,
  recordedAt: ENDED_AT,
};

let useAppStore: Awaited<ReturnType<typeof importStore>>;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const usageItem = (): Extract<TranscriptItem, { kind: 'usage' }> => ({
  kind: 'usage',
  key: 'usage-1',
  usage: {
    inputTokens: 100000,
    outputTokens: 1400,
    cachedInputTokens: 90000,
    cacheCreationInputTokens: 2000,
    contextTokens: 76000,
    estimatedCostUsd: 0.12,
  },
  runId: RUN_ID,
  at: ENDED_AT,
});

describe('TurnFooter', () => {
  it('shows model and time on the line, cost, tokens, cache and context in the detail', () => {
    useAppStore.setState({ sessionTelemetry: { [SESSION_ID]: [RECORD] } });
    render(
      <TurnFooter
        item={usageItem()}
        sessionId={SESSION_ID}
        agentId={AGENT_ID}
        startedAt={STARTED_AT}
      />,
    );
    screen.getByText('42s');
    screen.getByText('Opus 5');
    expect(screen.queryByText('~$0.12')).toBeNull();
    expect(screen.queryByText(/in ·/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Turn detail' }));
    screen.getByText('Input');
    screen.getByText('from cache');
    screen.getByText('Output');
    screen.getByText(NAMES.contextWindow);
    screen.getByText(/~\$0\.12/);
  });

  it('opens the detail popover on click', () => {
    render(<TurnFooter item={usageItem()} sessionId={null} agentId={null} />);
    expect(screen.queryByText('Input')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Turn detail' }));
    screen.getByText('Input');
    screen.getByText('Output');
  });

  it('sizes the detail card to its content, not to the footer trigger', () => {
    render(<TurnFooter item={usageItem()} sessionId={null} agentId={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Turn detail' }));
    const card = screen.getByText('Input').closest('[data-dropdown-portal] > div');
    expect(card instanceof HTMLElement).toBe(true);
    if (!(card instanceof HTMLElement)) {
      return;
    }
    expect(card.style.width).toBe('');
    expect(card.style.maxWidth).toBe('360px');
  });

  it('keeps the same model and time shape on a stopped turn, with a stopped glyph', () => {
    useAppStore.setState({ sessionTelemetry: { [SESSION_ID]: [RECORD] } });
    render(
      <TurnFooter
        item={usageItem()}
        sessionId={SESSION_ID}
        agentId={AGENT_ID}
        outcome="stopped"
        startedAt={STARTED_AT}
      />,
    );
    screen.getByText('Opus 5');
    screen.getByText('42s');
    expect(screen.queryByText(/after/)).toBeNull();
    expect(screen.queryByText(/in ·/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Turn detail' }));
    screen.getByText('Ended');
    expect(screen.getAllByText('Stopped').length).toBeGreaterThan(0);
  });

  it('marks a failed turn in the detail and keeps the line shape', () => {
    render(<TurnFooter item={usageItem()} sessionId={null} agentId={null} outcome="failed" />);
    expect(screen.queryByText(/in ·/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Turn detail' }));
    screen.getByText('Failed');
  });

  it('shows the premium requests of a Copilot turn on the line, with no price', () => {
    const item = usageItem();
    render(
      <TurnFooter
        item={{ ...item, usage: { ...item.usage, estimatedCostUsd: 0, premiumRequests: 2 } }}
        sessionId={null}
        agentId={null}
      />,
    );
    screen.getByText('2 premium requests');
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('leaves the premium requests off the line for a turn that billed none', () => {
    render(<TurnFooter item={usageItem()} sessionId={null} agentId={null} />);
    expect(screen.queryByText(/premium/)).toBeNull();
  });
});
