import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import type { AgentSpawnConfigValue } from '../../../session/components/AgentSpawnConfig/AgentSpawnConfigValue';

type SpawnAgent = (
  sessionId: SessionId,
  args: Readonly<Record<string, unknown>>,
) => Promise<string>;

type Store = {
  readonly sessions: ReadonlyArray<{ id: SessionId; goal: string }>;
  readonly sessionGitlabMr: Record<string, unknown>;
  readonly sessionBranches: Record<string, string>;
  readonly refreshSessionMr: ReturnType<typeof vi.fn>;
  readonly createMrForSession: ReturnType<typeof vi.fn>;
  readonly mergeMrForSession: ReturnType<typeof vi.fn>;
  readonly spawnAgent: ReturnType<typeof vi.fn<SpawnAgent>>;
  readonly selectAgent: ReturnType<typeof vi.fn>;
  readonly setCurrentSession: ReturnType<typeof vi.fn>;
};

type ConfigProps = {
  readonly onChange: (value: AgentSpawnConfigValue) => void;
  readonly disabled: boolean;
};

const h = vi.hoisted(() => ({
  config: {
    provider: 'gemini',
    model: 'gemini-3.5-flash',
    effort: 'low',
    hint: 'Mention the rollout order.',
  } satisfies AgentSpawnConfigValue,
  showToast: vi.fn(),
  store: {
    sessions: [{ id: 'session-3' as SessionId, goal: 'Prepare the GitLab release' }],
    sessionGitlabMr: {},
    sessionBranches: { 'session-3': 'ak/gitlab-release' },
    refreshSessionMr: vi.fn(async () => undefined),
    createMrForSession: vi.fn(async () => undefined),
    mergeMrForSession: vi.fn(async () => undefined),
    spawnAgent: vi.fn<SpawnAgent>(async () => 'agent-3'),
    selectAgent: vi.fn(async () => undefined),
    setCurrentSession: vi.fn(async () => undefined),
  } satisfies Store,
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Store) => T) => selector(h.store),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: h.showToast }),
}));

vi.mock('../../../session/components/AgentSpawnConfig', () => ({
  AgentSpawnConfig: ({ onChange, disabled }: ConfigProps) => (
    <button type="button" disabled={disabled} onClick={() => onChange(h.config)}>
      Choose agent config
    </button>
  ),
}));

import { MrDetailPanel } from './MrDetailPanel';

const SESSION_ID = 'session-3' as SessionId;

beforeEach(() => {
  h.store.refreshSessionMr.mockClear();
  h.store.spawnAgent.mockClear();
  h.store.selectAgent.mockClear();
  h.store.setCurrentSession.mockClear();
  h.showToast.mockClear();
});

afterEach(cleanup);

describe('MrDetailPanel', () => {
  it('spawns an MR agent with the chosen config and operator notes', async () => {
    const onClose = vi.fn();
    render(<MrDetailPanel sessionId={SESSION_ID} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose agent config' }));
    fireEvent.click(screen.getByRole('button', { name: 'Draft with an agent' }));

    await waitFor(() => expect(h.store.spawnAgent).toHaveBeenCalledOnce());
    const args = h.store.spawnAgent.mock.calls[0]![1];
    expect(args).toMatchObject({
      provider: 'gemini',
      model: 'gemini-3.5-flash',
      effort: 'low',
    });
    expect(args.initialPrompt).toContain(
      '\n\nOperator notes:\n---\nMention the rollout order.\n---',
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
