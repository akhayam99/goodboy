// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { brandId, type AgentId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { aDelegation, aView } from '../../../auto/testing/autoViewFixtures';
import { ConversationDock } from './index';

const AGENT_ID = brandId<AgentId>({ value: 'agent-implementer' });
const RUN_ID = brandId<ProviderRunId>({ value: 'run-ask' });
const AT = brandId<IsoDateTime>({ value: '2026-11-06T10:00:00.000Z' });
const session = aSession({ goal: 'Reinstall dependencies in payments-api' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessions: [session],
    sessionPhaseRuns: { [session.id]: [anAgent({ id: AGENT_ID, status: 'running' })] },
  });
});

afterEach(cleanup);

const renderDock = ({ hasAsks = true }: { readonly hasAsks?: boolean } = {}) =>
  render(
    <ConversationDock
      session={session}
      agentId={AGENT_ID}
      lead={<p data-dock-row="">Started by Auto.</p>}
      hasAsks={hasAsks}
      isMessageTyped={false}
      live={null}
      stop={null}
      isStopArmed={false}
      failure={null}
    />,
  );

describe('ConversationDock', () => {
  it('holds no row when nothing asks and no lead is given', () => {
    const { container } = render(
      <ConversationDock
        session={session}
        agentId={AGENT_ID}
        lead={undefined}
        hasAsks
        isMessageTyped={false}
        live={null}
        stop={null}
        isStopArmed={false}
        failure={null}
      />,
    );

    expect(container.querySelector('[data-dock-row]')).toBeNull();
  });

  it('keeps Stop outside the scroll, so a long ask never pushes it away', () => {
    render(
      <ConversationDock
        session={session}
        agentId={AGENT_ID}
        lead={<p data-dock-row="">A long ask.</p>}
        hasAsks={false}
        isMessageTyped={false}
        live={{ phrase: 'Thinking', startedAt: null, waitingFor: null, stepAgentId: null }}
        stop={{
          label: 'Stop',
          phase: 'idle',
          sentence: null,
          isLineShown: true,
          stop: () => undefined,
        }}
        isStopArmed={false}
        failure={null}
      />,
    );

    const ask = screen.getByText('A long ask.');
    const stop = screen.getByRole('button', { name: 'Stop' });
    expect(ask.parentElement?.contains(stop)).toBe(false);
  });

  it('keeps the lead in the dock', () => {
    renderDock();

    screen.getByText('Started by Auto.');
  });

  it('asks a permission above the lead, once', () => {
    useAppStore.setState({
      agentTurnState: { [AGENT_ID]: { kind: 'blocked', runId: RUN_ID, blockedAt: AT } },
      transcripts: {
        [AGENT_ID]: [
          {
            kind: 'permission_request',
            runId: RUN_ID,
            toolUseId: 'tool-1',
            toolName: 'Bash',
            input: { command: 'rm -rf node_modules' },
            at: AT,
          },
        ],
      },
    });
    const { container } = renderDock();
    const dock = container.querySelector<HTMLElement>('[data-conversation-dock]');
    if (dock === null) {
      throw new Error('no dock');
    }

    const ask = within(dock).getByText('rm -rf node_modules');
    expect(
      ask.compareDocumentPosition(screen.getByText('Started by Auto.')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
  });

  it('reads the transcript of a subagent held after a reload, so its ask reaches Auto', async () => {
    const child = brandId<AgentId>({ value: 'agent-tester' });
    const load = vi.fn(async () => undefined);
    const view = aView({
      delegations: [
        {
          ...aDelegation({ key: 'tester', role: 'tester', state: 'running' }),
          childAgentId: child,
        },
      ],
    });
    useAppStore.setState({
      loadAgentTranscript: load,
      agentTurnState: { [child]: { kind: 'blocked', runId: RUN_ID, blockedAt: AT } },
      autoTreeViews: {
        [session.id]: [{ ...view, tree: { ...view.tree, rootAgentId: AGENT_ID } }],
      },
    });
    renderDock();

    await waitFor(() =>
      expect(load).toHaveBeenCalledWith(session.id, child, { isSelecting: false }),
    );
  });

  it('leaves the ask in the chat when the page gives it no dock', () => {
    useAppStore.setState({
      agentTurnState: { [AGENT_ID]: { kind: 'blocked', runId: RUN_ID, blockedAt: AT } },
      transcripts: {
        [AGENT_ID]: [
          {
            kind: 'permission_request',
            runId: RUN_ID,
            toolUseId: 'tool-1',
            toolName: 'Bash',
            input: { command: 'rm -rf node_modules' },
            at: AT,
          },
        ],
      },
    });
    renderDock({ hasAsks: false });

    expect(screen.queryByText('rm -rf node_modules')).toBeNull();
  });
});
