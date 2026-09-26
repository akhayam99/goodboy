// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  AgentId,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  TelemetryRecord,
} from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';

type ExecutedAgentRouting = { provider: string; model: string; effort: string | null };

type Store = {
  runRouting: Record<string, Record<string, ExecutedAgentRouting>>;
  sessionTelemetry: Record<string, ReadonlyArray<TelemetryRecord>>;
};

const { store } = vi.hoisted(() => ({
  store: { runRouting: {}, sessionTelemetry: {} } as Store,
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Store) => T) => selector(store),
}));

import { TurnFooter } from './index';

afterEach(() => {
  cleanup();
  store.runRouting = {};
  store.sessionTelemetry = {};
});

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const RUN_ID = 'run-1' as ProviderRunId;

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
  at: '2026-06-08T10:00:42.000Z' as IsoDateTime,
});

describe('TurnFooter', () => {
  it('shows tokens, cached percentage and cost for a done turn', () => {
    store.sessionTelemetry = {
      [SESSION_ID]: [
        {
          id: 'rec-1',
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
          recordedAt: '2026-06-08T10:00:42.000Z' as IsoDateTime,
        } as TelemetryRecord,
      ],
    };
    render(
      <TurnFooter
        item={usageItem()}
        sessionId={SESSION_ID}
        agentId={AGENT_ID}
        startedAt={'2026-06-08T10:00:00.000Z' as IsoDateTime}
      />,
    );
    expect(screen.getByText('42s')).toBeTruthy();
    expect(screen.getByText(/in ·/)).toBeTruthy();
    expect(screen.getByText('~$0.12')).toBeTruthy();
    expect(screen.getByText('47% cached')).toBeTruthy();
  });

  it('never shows $0.00: hides the cost entry when it is unknown', () => {
    render(<TurnFooter item={usageItem()} sessionId={null} agentId={null} />);
    expect(screen.queryByText('~$0.00')).toBeNull();
  });

  it('opens the detail popover on click', () => {
    render(<TurnFooter item={usageItem()} sessionId={null} agentId={null} />);
    expect(screen.queryByText('Input')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Turn detail' }));
    expect(screen.getByText('Input')).toBeTruthy();
    expect(screen.getByText('Output')).toBeTruthy();
  });

  it('renders a stopped row with the stopped node instead of the full stats line', () => {
    render(
      <TurnFooter
        item={usageItem()}
        sessionId={null}
        agentId={null}
        outcome="stopped"
        startedAt={'2026-06-08T10:00:00.000Z' as IsoDateTime}
      />,
    );
    expect(screen.getByText('Stopped after 42s')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Turn detail' })).toBeNull();
  });

  it('renders a failed row with the failed node', () => {
    render(<TurnFooter item={usageItem()} sessionId={null} agentId={null} outcome="failed" />);
    expect(screen.getByText('Failed')).toBeTruthy();
  });
});
