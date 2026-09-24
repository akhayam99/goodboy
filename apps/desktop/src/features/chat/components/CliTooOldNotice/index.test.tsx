// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AgentId, IsoDateTime, ProviderRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { INITIAL_LIFECYCLE_MAP } from '../../../../store/slices/providers';
import { buildProviderList } from '../../../providers/providers';
import type { CliTooOldPayload } from '../../turn';
import { CliTooOldNotice } from './index';

vi.mock('../../../providers/components/InlineTerminal', () => ({
  InlineTerminal: () => <div>update terminal</div>,
}));

const RUN = 'run-1' as ProviderRunId;

const PAYLOAD: CliTooOldPayload = {
  providerId: 'anthropic',
  modelKey: 'opus-5.5',
  installedVersion: '2.1.259',
  requiredVersion: '2.1.280',
  fallbackModelKey: null,
  detail: 'API Error: 400 Claude Code 2.1.259 does not support this model',
};

const seedClaude = ({ version }: { readonly version: string }) => {
  useAppStore.setState({
    providers: buildProviderList(
      {
        anthropic: {
          id: 'anthropic',
          binary: 'claude',
          available: true,
          version: `${version} (Claude Code)`,
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

beforeEach(() => {
  seedClaude({ version: '2.1.259' });
  useAppStore.setState({
    cliRequirements: [],
    providerLifecycle: INITIAL_LIFECYCLE_MAP,
    agentTurnState: {},
    runRouting: {},
  });
});

afterEach(() => {
  cleanup();
});

describe('CliTooOldNotice', () => {
  it('names the model and both versions and offers the update and the sibling', () => {
    const onRetryRun = vi.fn();
    render(
      <CliTooOldNotice payload={PAYLOAD} runId={RUN} onRetryRun={onRetryRun} isRetrying={false} />,
    );
    expect(screen.getByText('Opus 5.5 needs a newer Claude CLI')).toBeDefined();
    expect(
      screen.getByText(
        'You have Claude CLI 2.1.259. Opus 5.5 needs 2.1.280 or newer. Your message is kept.',
      ),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Use Opus 5 instead' }));
    expect(onRetryRun).toHaveBeenCalledWith({ runId: RUN, model: 'opus-5' });
  });

  it('starts the update in place', () => {
    const updateProviderCli = vi.fn(async () => undefined);
    useAppStore.setState({ updateProviderCli });
    render(<CliTooOldNotice payload={PAYLOAD} runId={RUN} isRetrying={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Update Claude CLI' }));
    expect(updateProviderCli).toHaveBeenCalledWith('anthropic');
  });

  it('shows the terminal while the update runs', () => {
    useAppStore.setState({
      providerLifecycle: {
        ...INITIAL_LIFECYCLE_MAP,
        anthropic: {
          ...INITIAL_LIFECYCLE_MAP.anthropic,
          phase: 'updating',
          action: 'update',
          runId: 'pty-1',
        },
      },
    });
    render(<CliTooOldNotice payload={PAYLOAD} runId={RUN} isRetrying={false} />);
    expect(screen.getByRole('button', { name: 'Updating Claude CLI' })).toBeDefined();
    expect(screen.getByText('update terminal')).toBeDefined();
  });

  it('waits while a Claude turn is running', () => {
    useAppStore.setState({
      agentTurnState: {
        ['agent-1' as AgentId]: {
          kind: 'running',
          runId: RUN,
          startedAt: '2026-09-25T00:00:00Z' as IsoDateTime,
        },
      },
      runRouting: {
        ['agent-1' as AgentId]: { [RUN]: { provider: 'anthropic', model: 'claude-opus-5' } },
      },
    });
    render(<CliTooOldNotice payload={PAYLOAD} runId={RUN} isRetrying={false} />);
    expect(screen.getByRole('button', { name: 'Update Claude CLI' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByText(/Wait for running turns to finish\./)).toBeDefined();
  });

  it('turns into a success with Retry the turn once the CLI is new enough', () => {
    seedClaude({ version: '2.1.281' });
    const onRetryRun = vi.fn();
    render(
      <CliTooOldNotice payload={PAYLOAD} runId={RUN} onRetryRun={onRetryRun} isRetrying={false} />,
    );
    expect(screen.getByText('Claude CLI 2.1.281 is installed.')).toBeDefined();
    expect(screen.getByText('Opus 5.5 is ready in this session.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Retry the turn' }));
    expect(onRetryRun).toHaveBeenCalledWith({ runId: RUN, model: null });
  });

  it('says where the turn went when it already fell back', () => {
    render(
      <CliTooOldNotice
        payload={{ ...PAYLOAD, fallbackModelKey: 'opus-5' }}
        runId={RUN}
        onRetryRun={vi.fn()}
        isRetrying={false}
      />,
    );
    expect(screen.getByText(/This turn ran on Opus 5 instead\./)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Use Opus 5 instead' })).toBeNull();
  });
});
