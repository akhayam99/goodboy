import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AgentId, SessionId } from '@goodboy/types';
import {
  importStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  type StoryStore,
} from '../../store/storyHarness';
import { summarizerQueues } from '../../store/slices/turn/turnHelpers';
import { ToastProvider } from '../../shared/components/Toast';
import { AssistantText } from '../chat/components/TranscriptCards/AssistantText';
import { AgentBriefPullRequestText } from './components/AgentDetailPane/AgentBriefPullRequestText';
import {
  acceptCreate,
  askScribe,
  createCalls,
  followUpToScribe,
  PROPOSAL,
  rejectCreate,
  reloadScribeAgent,
  scribeAgentIdOf,
  scribeTurn,
  scribeWorkOf,
  seedScribeBranch,
  settleScribeWork,
} from '../../test/scribeSqliteFixture';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../chat/turn', async () => (await import('../../store/storyHarness')).turnModuleMock());
vi.mock('../permissions/permissions', async () =>
  (await import('../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../providers/providers', async () =>
  (await import('../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../providers/routing', async () =>
  (await import('../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../budget/budget', async () =>
  (await import('../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../skills/skills', async () =>
  (await import('../../store/storyHarness')).skillsModuleMock(),
);
vi.mock('../worktree/worktree', async () =>
  (await import('../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../shared/lib/repo', async () =>
  (await import('../../store/storyHarness')).repoModuleMock(),
);
vi.mock('../plans/plans', async () => (await import('../../store/storyHarness')).plansModuleMock());
vi.mock('../integrations/github/github', async (importOriginal) =>
  (await import('../../test/scribeSqliteFixture')).githubModuleWithSpies(
    await importOriginal<Record<string, unknown>>(),
  ),
);

let useAppStore: StoryStore;
let sessionId: SessionId;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  sessionId = await seedScribeBranch({ useAppStore });
});

afterEach(async () => {
  cleanup();
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

const askAndSettle = async () => {
  storySpies.runTurn.mockImplementation(scribeTurn({ answer: PROPOSAL }));
  await askScribe({ useAppStore, sessionId });
  await settleScribeWork({ useAppStore });
};

const briefOf = ({ agentId }: { readonly agentId: AgentId }) =>
  render(<AgentBriefPullRequestText sessionId={sessionId} agentId={agentId} />);

const cardOf = ({ agentId }: { readonly agentId: AgentId }) =>
  render(
    <ToastProvider>
      <AssistantText text={PROPOSAL} sessionId={sessionId} agentId={agentId} />
    </ToastProvider>,
  );

describe('the Scribe Brief and transcript card when opening fails', () => {
  it('shows the reason with the text kept, and opens the draft on Retry', async () => {
    rejectCreate({ stderr: 'GraphQL: Resource not accessible by personal access token' });
    await askAndSettle();

    briefOf({ agentId: scribeAgentIdOf({ useAppStore }) });

    expect(screen.getByText('Guard settlement postings')).toBeDefined();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain("Couldn't write the pull request text");
    expect(alert.textContent).not.toContain('GraphQL');
    fireEvent.click(within(alert).getByRole('button', { name: 'Details' }));
    expect(alert.textContent).toContain(
      'GraphQL: Resource not accessible by personal access token',
    );
    acceptCreate();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await screen.findByText('Created #418');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(scribeWorkOf({ useAppStore })?.status).toBe('created');
  });
});

describe('the Scribe Brief after a follow-up turn', () => {
  it('keeps the proposal when the answer brings no new text', async () => {
    await askAndSettle();

    await followUpToScribe({
      useAppStore,
      sessionId,
      answer: 'got it - PR text ready, engine creates the draft. standing by.',
      content: "didn't you create the PR?",
    });

    briefOf({ agentId: scribeAgentIdOf({ useAppStore }) });
    expect(screen.getByText('Guard settlement postings')).toBeDefined();
    expect(screen.getByText('Retried batches no longer post twice.')).toBeDefined();
    expect(screen.getByText('Created #418')).toBeDefined();
    expect(createCalls()).toHaveLength(1);
  });

  it('changes only what the follow-up rewrites', async () => {
    await askAndSettle();

    await followUpToScribe({
      useAppStore,
      sessionId,
      answer: '<<pr-body>>\nPostings are keyed by event id.\n<</pr-body>>',
      content: 'shorter body please',
    });

    briefOf({ agentId: scribeAgentIdOf({ useAppStore }) });
    expect(screen.getByText('Guard settlement postings')).toBeDefined();
    expect(screen.getByText('Postings are keyed by event id.')).toBeDefined();
    expect(screen.queryByText('Retried batches no longer post twice.')).toBeNull();
  });
});

describe('the Scribe Brief and transcript card after the app reloads', () => {
  it('still shows the proposal, and Create PR opens the draft from it', async () => {
    await askAndSettle();
    const agentId = await reloadScribeAgent({ useAppStore, sessionId });
    const created = createCalls().length;

    briefOf({ agentId });

    expect(await screen.findByText('Guard settlement postings')).toBeDefined();
    expect(screen.getByText('Retried batches no longer post twice.')).toBeDefined();
    expect(screen.getByText('Not opened yet')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Create PR' }));

    await screen.findByText('Created #418');
    expect(createCalls()).toHaveLength(created + 1);
  });

  it('draws the card in the transcript with its state, without the raw blocks', async () => {
    await askAndSettle();
    const agentId = await reloadScribeAgent({ useAppStore, sessionId });

    cardOf({ agentId });

    const card = await screen.findByTestId('scribe-proposal');
    expect(card.textContent).toContain('Pull request text');
    expect(card.textContent).toContain('Guard settlement postings');
    expect(card.textContent).toContain('Not opened yet');
    expect(screen.queryByText('<<pr-title>>', { exact: false })).toBeNull();
  });

  it('says Created in the card once the engine opened the draft', async () => {
    await askAndSettle();

    cardOf({ agentId: scribeAgentIdOf({ useAppStore }) });

    await waitFor(() =>
      expect(screen.getByTestId('scribe-proposal').textContent).toContain('Created #418'),
    );
  });
});
