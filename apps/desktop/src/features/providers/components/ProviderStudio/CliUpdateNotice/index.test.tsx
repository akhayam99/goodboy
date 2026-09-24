// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { AgentId, IsoDateTime, ProviderRunId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { INITIAL_LIFECYCLE_MAP } from '../../../../../store/slices/providers';
import { buildProviderList } from '../../../providers';
import { CliUpdateNotice } from './index';

vi.mock('../../InlineTerminal', () => ({
  InlineTerminal: () => <div>update terminal</div>,
}));

const RUN = 'run-1' as ProviderRunId;

const seedClaude = ({ version }: { readonly version: string }) => {
  useAppStore.setState({
    providers: buildProviderList(
      {
        anthropic: {
          id: 'anthropic',
          binary: 'claude',
          available: true,
          version,
          error: null,
        },
        cursor: null,
        codex: null,
        gemini: null,
        opencode: null,
        openrouter: null,
        moonshot: null,
      },
      { anthropic: { state: 'connected', identity: null } },
      new Set(),
    ),
  });
};

const updateProviderCli = vi.fn(async () => undefined);

beforeEach(() => {
  updateProviderCli.mockClear();
  seedClaude({ version: '2.1.240' });
  useAppStore.setState({
    cliRequirements: [],
    providerLifecycle: INITIAL_LIFECYCLE_MAP,
    agentTurnState: {},
    runRouting: {},
    updateProviderCli,
  });
});

afterEach(() => {
  cleanup();
});

describe('CliUpdateNotice', () => {
  it('names every model the installed CLI cannot run', () => {
    render(<CliUpdateNotice providerId="anthropic" autoStart={false} />);
    expect(screen.getByText('Update needed for Fable 5.1 and Opus 5.5')).toBeDefined();
    expect(screen.getByText('2.1.280 or newer. You have 2.1.240.')).toBeDefined();
    expect(updateProviderCli).not.toHaveBeenCalled();
  });

  it('stays out of the way on a current CLI', () => {
    seedClaude({ version: '2.1.300' });
    const { container } = render(<CliUpdateNotice providerId="anthropic" autoStart />);
    expect(container.textContent).toBe('');
  });

  it('starts the update when opened from the update action', () => {
    render(<CliUpdateNotice providerId="anthropic" autoStart />);
    expect(updateProviderCli).toHaveBeenCalledOnce();
    expect(updateProviderCli).toHaveBeenCalledWith('anthropic');
  });

  it('holds the update while a turn on the provider runs', () => {
    useAppStore.setState({
      agentTurnState: {
        ['agent-1' as AgentId]: {
          kind: 'running',
          runId: RUN,
          startedAt: '2026-09-25T00:00:00Z' as IsoDateTime,
        },
      },
      runRouting: {
        ['agent-1' as AgentId]: {
          [RUN]: { provider: 'anthropic', model: 'claude-opus-5', effort: null },
        },
      },
    });
    render(<CliUpdateNotice providerId="anthropic" autoStart />);
    expect(updateProviderCli).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Update Claude CLI' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByText(/Wait for running turns to finish\./)).toBeDefined();
  });
});
