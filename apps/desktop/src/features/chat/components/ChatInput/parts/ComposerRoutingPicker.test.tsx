// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderRunId,
  Session,
  SessionId,
  TelemetryRecord,
} from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import { useAppStore } from '../../../../../store';
import { ComposerAgentRoutingPicker } from './ComposerAgentRoutingPicker';
import { ComposerRoutingPickerView, type ComposerRouting } from './ComposerRoutingPickerView';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const RUN_ID = 'run-1' as ProviderRunId;

const session: Session = aSession({
  id: SESSION_ID,
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
});

const agent: Agent = anAgent({
  id: AGENT_ID,
  sessionId: SESSION_ID,
  name: 'Plan the work',
  status: 'completed',
  kind: 'planner',
  runId: RUN_ID,
});

const turn = {
  id: 'rec-1',
  runId: RUN_ID,
  sessionId: SESSION_ID,
  kind: 'turn',
  provider: 'anthropic',
  model: 'claude-opus-5',
  inputTokens: 10,
  outputTokens: 2,
  estimatedCostUsd: 0.1,
  recordedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
} as TelemetryRecord;

const routingOn = ({ modelId }: { readonly modelId: string }): ComposerRouting => ({
  effectiveProvider: 'anthropic',
  effectiveModelId: modelId,
  effectiveEffort: 'medium',
  verbosity: 'normal',
  connectedProviderIds: ['anthropic'],
  allowOverride: true,
  isOverridden: false,
  referenceProvider: 'anthropic',
  referenceModel: modelId,
  setVerbosity: vi.fn(),
  onSelectRoute: vi.fn(),
  onResetTurnOverride: vi.fn(),
});

const seed = ({ ran }: { readonly ran: boolean }): void => {
  useAppStore.setState({
    selectedAgentId: { [SESSION_ID]: AGENT_ID },
    sessionPhaseRuns: { [SESSION_ID]: [agent] },
    sessionTelemetry: { [SESSION_ID]: ran ? [turn] : [] },
    agentRunHistory: { [AGENT_ID]: ran ? [RUN_ID] : [] },
  });
};

const trigger = (): HTMLElement => screen.getByRole('button', { name: /^Model routing:/ });

afterEach(() => {
  cleanup();
  useAppStore.setState({
    selectedAgentId: {},
    sessionPhaseRuns: {},
    sessionTelemetry: {},
    agentRunHistory: {},
  });
});

describe('the composer model chip', () => {
  it('stays quiet while it names the model the header already shows', () => {
    seed({ ran: true });
    render(
      <ComposerAgentRoutingPicker
        session={session}
        agent={agent}
        routing={routingOn({ modelId: 'claude-opus-5' })}
      />,
    );

    expect(trigger().textContent).toContain('Model');
    expect(trigger().textContent).not.toContain('Opus 5');
    expect(trigger().textContent).not.toContain('Next turn');
  });

  it('names the model as the next turn when it differs from the header', () => {
    seed({ ran: true });
    render(
      <ComposerAgentRoutingPicker
        session={session}
        agent={agent}
        routing={routingOn({ modelId: 'claude-sonnet-5' })}
      />,
    );

    expect(trigger().textContent).toContain('Next turn');
    expect(trigger().textContent).toContain('Sonnet 5');
  });

  it('shows the model plainly when no agent is selected', () => {
    render(
      <ComposerRoutingPickerView header={null} routing={routingOn({ modelId: 'claude-opus-5' })} />,
    );

    expect(trigger().textContent).toContain('Opus 5');
    expect(trigger().textContent).not.toContain('Next turn');
  });
});
