import { describe, expect, it } from 'vitest';
import { INITIAL_CONNECT_MAP } from '../../store/slices/providers/types';
import { agentRowOf } from '../onboarding/OnboardingWizard/agentRowOf';
import type { AgentCheck } from '../onboarding/OnboardingWizard/useAgentDetection/agentChecks';
import { buildProviderList, type AuthState, type ProviderStatus } from './providers';
import { statusOfInfo } from './statusOfInfo';

const NO_STATUSES = {
  anthropic: null,
  cursor: null,
  codex: null,
  gemini: null,
  copilot: null,
  opencode: null,
  openrouter: null,
  moonshot: null,
};

const CHECK: AgentCheck = { isChecking: false, failure: null };

type Params = {
  readonly status: ProviderStatus | null;
  readonly auth?: AuthState | null;
};

const copilotRowOf = ({ status, auth = null }: Params) => {
  const providers = buildProviderList(
    { ...NO_STATUSES, copilot: status },
    { copilot: auth },
    new Set(),
  );
  const info = providers.find((provider) => provider.id === 'copilot') ?? null;
  return agentRowOf({
    id: 'copilot',
    info,
    status: statusOfInfo({ id: 'copilot', info }),
    connect: INITIAL_CONNECT_MAP.copilot,
    check: CHECK,
  });
};

const found: ProviderStatus = {
  id: 'copilot',
  binary: 'copilot',
  available: true,
  version: 'copilot 1.4.2',
  error: null,
};

describe('statusOfInfo for an agent row', () => {
  it('keeps looking while nothing has answered yet', () => {
    expect(copilotRowOf({ status: null }).state).toBe('looking');
  });

  it('shows sign in when the CLI is found but its sign-in is unknown', () => {
    const row = copilotRowOf({ status: found, auth: { state: 'unknown', identity: null } });

    expect(row.state).not.toBe('looking');
    expect(row.isFound).toBe(true);
    expect(row.line).toContain('1.4.2');
  });

  it('shows a failure when the CLI timed out or exited on start', () => {
    for (const errorKind of ['timeout', 'exit'] as const) {
      const row = copilotRowOf({
        status: {
          ...found,
          available: false,
          version: null,
          error: 'copilot did not answer',
          errorKind,
        },
      });

      expect(row.state).toBe('broken');
      expect(row.output).toBe('copilot did not answer');
    }
  });

  it('shows a failure for a timeout that carries no message', () => {
    const row = copilotRowOf({
      status: { ...found, available: false, version: null, error: null, errorKind: 'timeout' },
    });

    expect(row.state).toBe('broken');
  });

  it('reports a missing CLI as missing', () => {
    const row = copilotRowOf({
      status: { ...found, available: false, version: null, error: null, errorKind: 'notFound' },
    });

    expect(row.state).toBe('missing');
  });
});
