// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { aProject, anAgent, aSession, nextWorkspaceId } from '@goodboy/types/testing';
import { brandId, type AgentId, type IsoDateTime } from '@goodboy/types';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import { WriterWaitBand } from './WriterWaitBand';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

const WORKSPACE_ID = nextWorkspaceId();
const NOTES = '/tmp/Documents/acme-notes';
const notes = aProject({
  workspaceId: WORKSPACE_ID,
  name: 'acme-notes',
  rootPath: NOTES,
  kind: 'folder',
});
const writing = aSession({ workspaceId: WORKSPACE_ID, goal: 'Tighten the launch memo' });
const waiting = aSession({ workspaceId: WORKSPACE_ID, goal: 'Summarize interview notes' });
const writer = anAgent({ sessionId: writing.id, name: 'Claude' });
const waiter = anAgent({ sessionId: waiting.id, name: 'Claude' });
const SINCE = brandId<IsoDateTime>({ value: '2026-10-17T10:00:00.000Z' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  act(() => {
    useAppStore.setState({
      projects: [notes],
      sessions: [writing, waiting],
      sessionPhaseRuns: { [writing.id]: [writer], [waiting.id]: [waiter] },
    });
  });
});

afterEach(() => {
  cleanup();
});

const waitBehind = ({
  agentId,
  blockedBy,
  blockedPath = NOTES,
}: {
  readonly agentId: AgentId;
  readonly blockedBy: string;
  readonly blockedPath?: string;
}) => {
  act(() => {
    useAppStore.setState({
      agentWriterWait: {
        [agentId]: { sessionId: waiting.id, blockedPath, blockedBy, since: SINCE },
      },
    });
  });
};

describe('WriterWaitBand', () => {
  it('renders nothing while the agent does not wait', () => {
    render(<WriterWaitBand sessionId={waiting.id} agentId={waiter.id} />);

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('names the folder and the session writing there, with the two ways out', () => {
    waitBehind({ agentId: waiter.id, blockedBy: writer.id });
    render(<WriterWaitBand sessionId={waiting.id} agentId={waiter.id} />);

    const band = screen.getByRole('status');
    expect(band.textContent).toContain('Waiting to write in acme-notes.');
    expect(band.textContent).toContain(
      'Tighten the launch memo is writing there now. One session writes in a folder at a time.',
    );
    screen.getByRole('button', { name: 'Answer without editing' });
    screen.getByRole('button', { name: 'Cancel' });
  });

  it('Answer without editing and Cancel name the waiting agent', () => {
    const answerWithoutEditing = vi.fn(() => true);
    const cancelWriterWait = vi.fn(() => true);
    act(() => {
      useAppStore.setState({ answerWithoutEditing, cancelWriterWait });
    });
    waitBehind({ agentId: waiter.id, blockedBy: writer.id });
    render(<WriterWaitBand sessionId={waiting.id} agentId={waiter.id} />);

    fireEvent.click(screen.getByRole('button', { name: 'Answer without editing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(answerWithoutEditing).toHaveBeenCalledWith({ agentId: waiter.id });
    expect(cancelWriterWait).toHaveBeenCalledWith({ agentId: waiter.id });
  });

  it('falls back to the plain writer line when the blocked path is no plain folder', () => {
    waitBehind({
      agentId: waiter.id,
      blockedBy: writer.id,
      blockedPath: '/repos/ledger-core/.git',
    });
    render(<WriterWaitBand sessionId={waiting.id} agentId={waiter.id} />);

    expect(screen.getByRole('status').textContent).toContain('Waiting for the writer.');
  });
});
