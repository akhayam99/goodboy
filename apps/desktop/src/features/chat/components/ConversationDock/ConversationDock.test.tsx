// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { brandId, type AgentId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { aDelegation, aView } from '../../../auto/testing/autoViewFixtures';
import { getAutoTree, listAutoAttemptsOfDelegation, listAutoDelegations } from '@goodboy/db';
import { registerAutoUserTurnPort } from '../../../auto/autoUserTurnPort';
import {
  makeRuntimeWorld,
  userSays,
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
} from '../../../../store/runtime/auto/testing/runtimeWorld';
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

afterEach(() => {
  cleanup();
  registerAutoUserTurnPort({ port: null });
});

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

describe('Auto child recovery through the dock', () => {
  it.each(['no_closing_envelope', 'process_error'])(
    'creates an Auto attempt after one Retry for %s',
    async (reason) => {
      const world = await makeRuntimeWorld({ capUsd: 10 });
      await userSays({ world, id: 'harborline-goal', text: 'Update ledger-core' });
      await autoDelegates({
        world,
        spec: {
          children: [
            {
              role: 'implementer',
              task: 'Update ledger-core',
              reason: 'Acme needs the change',
              mount: 'mount-ledger-core',
            },
          ],
        },
      });
      await autoTurnEnds({ world });
      await childTurnEnds({
        world,
        index: 0,
        text: 'Harborline could not finish.',
        overrides: reason === 'process_error' ? { exit: 'error' } : {},
      });
      await autoTurnEnds({ world });
      const db = world.state.world.db;
      const tree = await getAutoTree({ db, treeId: world.treeId });
      const [delegation] = await listAutoDelegations({ db, treeId: world.treeId });
      if (tree === null || delegation === undefined) {
        throw new Error('The Auto child was not created');
      }
      const targetSession = aSession({ id: tree.sessionId });
      const agentId = delegation.childAgentId;
      stubStoryInvoke({ db_select: [], db_execute: 1 });
      useAppStore.setState({
        sessions: [targetSession],
        sessionPhaseRuns: {
          [targetSession.id]: [
            anAgent({ id: tree.rootAgentId, kind: 'auto', status: 'running' }),
            anAgent({ id: agentId, status: 'failed', parentAgentId: tree.rootAgentId }),
          ],
        },
        autoTreeViews: {
          [targetSession.id]: [
            { ...aView({ phase: tree.phase, delegations: [delegation] }), tree },
          ],
        },
      });
      registerAutoUserTurnPort({
        port: async ({ text, onQueued }) => {
          const result = await world.runtime.say({ treeId: tree.id, text });
          if (result.kind === 'lost') {
            return 'lost';
          }
          onQueued?.({ rowId: result.rowId });
          await world.runtime.settled();
          return 'queued';
        },
      });
      render(
        <ConversationDock
          session={targetSession}
          agentId={agentId}
          lead={null}
          hasAsks={false}
          isMessageTyped={false}
          live={null}
          stop={null}
          isStopArmed={false}
          failure={
            reason === 'process_error'
              ? {
                  message: 'The provider failed.',
                  runId: RUN_ID,
                  isRetrying: false,
                  retry: () => {
                    throw new Error('Generic retry must not run');
                  },
                }
              : null
          }
        />,
      );
      expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      });
      await waitFor(() =>
        expect(world.state.ports.autoTurns.at(-1)?.text).toContain(`delegation ${delegation.id}`),
      );

      await autoDelegates({
        world,
        requestId: 'harborline-retry',
        spec: { children: [{ retryOf: delegation.id, reason: 'The operator asked to retry' }] },
      });
      await autoTurnEnds({ world });

      const repeated = (await listAutoDelegations({ db, treeId: tree.id })).find(
        (row) => row.retryOf === delegation.id,
      );
      if (repeated === undefined) {
        throw new Error('Auto did not create the retry');
      }
      const attempts = await listAutoAttemptsOfDelegation({ db, delegationId: repeated.id });
      expect(attempts).toHaveLength(1);
      expect(attempts[0]?.id).not.toBe(delegation.firstAttemptId);
      expect(repeated.childAgentId).toBe(agentId);
    },
  );
});
