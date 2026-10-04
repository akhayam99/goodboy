// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { AgentId, IsoDateTime, ProviderRunId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { IDLE_LIFECYCLE, INITIAL_LIFECYCLE_MAP } from '../../../../../store/slices/providers/types';
import type { CliUpdateResult } from '../../../cliUpdateResult';
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

const seedUpdateRun = ({
  phase,
  update,
}: {
  readonly phase: 'installed' | 'error';
  readonly update: CliUpdateResult | null;
}) => {
  useAppStore.setState({
    providerLifecycle: {
      ...INITIAL_LIFECYCLE_MAP,
      anthropic: {
        ...IDLE_LIFECYCLE,
        action: 'update',
        phase,
        runId: RUN,
        command: 'claude update',
        update,
      },
    },
  });
};

describe('CliUpdateNotice', () => {
  it('names every model the installed CLI cannot run', () => {
    render(<CliUpdateNotice providerId="anthropic" autoStart={false} />);
    expect(
      screen.getByText('Fable 5.1, Opus 5.5 and Sonnet 5.5 need a newer Claude CLI'),
    ).toBeDefined();
    expect(
      screen.getByText('You have Claude CLI 2.1.240. Update to 2.1.284 or newer.'),
    ).toBeDefined();
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

  it('ends on a warning with the PATH binary and keeps the terminal when nothing changed', () => {
    seedUpdateRun({
      phase: 'installed',
      update: {
        outcome: 'unchanged',
        before: '2.1.240',
        after: '2.1.240',
        binaryPath: '/usr/local/bin/claude',
      },
    });
    render(<CliUpdateNotice providerId="anthropic" autoStart={false} />);
    expect(screen.getByText('Claude CLI is still 2.1.240')).toBeDefined();
    expect(
      screen.getByText(
        'The update ran, but nothing changed. The Claude CLI on your PATH is /usr/local/bin/claude. Update that install, or run claude update in your own terminal.',
      ),
    ).toBeDefined();
    expect(screen.getByText('update terminal')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });

  it('ends on success only once the detected version changed', () => {
    seedClaude({ version: '2.1.300' });
    seedUpdateRun({
      phase: 'installed',
      update: { outcome: 'updated', before: '2.1.240', after: '2.1.300', binaryPath: null },
    });
    render(<CliUpdateNotice providerId="anthropic" autoStart={false} />);
    expect(screen.getByText('Claude CLI updated to 2.1.300.')).toBeDefined();
    expect(screen.queryByText('update terminal')).toBeNull();
  });

  it('ends on the failed notice with the terminal when the update errors', () => {
    seedUpdateRun({ phase: 'error', update: null });
    render(<CliUpdateNotice providerId="anthropic" autoStart={false} />);
    expect(screen.getByText(/The update didn't finish\./)).toBeDefined();
    expect(screen.getByText('update terminal')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });
});
