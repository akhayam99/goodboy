import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractScribeText } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { reduceTranscript } from '../features/chat/utils/transcript-items';
import { scribeProposalOf } from '../shared/utils/scribeProposal';
import { summarizerQueues } from './slices/turn/turnHelpers';
import {
  importStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  type StoryStore,
} from './storyHarness';
import {
  acceptCreate,
  askScribe,
  BRANCH,
  createCall,
  createCalls,
  followUpToScribe,
  gh,
  MOUNT_ID,
  PROPOSAL,
  rejectCreate,
  reloadScribeAgent,
  scribeAgentIdOf,
  SCRIBE_KEY,
  scribeTurn,
  scribeWorkOf,
  seedScribeBranch,
  settleScribeWork,
  WORKTREE_PATH,
} from '../test/scribeSqliteFixture';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).sqliteDbLibModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());
vi.mock('../features/integrations/github/github', async (importOriginal) =>
  (await import('../test/scribeSqliteFixture')).githubModuleWithSpies(
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
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

const work = () => scribeWorkOf({ useAppStore });

const askAndSettle = async () => {
  storySpies.runTurn.mockImplementation(scribeTurn({ answer: PROPOSAL }));
  await askScribe({ useAppStore, sessionId });
  await settleScribeWork({ useAppStore });
};

describe('Create PR through the Scribe on a branch that was never pushed', () => {
  it('pushes the branch and opens the draft with the text the Scribe wrote after its tool calls', async () => {
    await askAndSettle();

    expect(work()?.status).toBe('created');
    expect(gh.push).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ cwd: WORKTREE_PATH, branch: BRANCH }),
    );
    const create = createCall();
    const args = create?.[0] ?? [];
    expect(args).toContain('--draft');
    expect(args[args.indexOf('--title') + 1]).toBe('Guard settlement postings');
    expect(args[args.indexOf('--body') + 1]).toContain('Retried batches no longer post twice.');
    expect(gh.push.mock.invocationCallOrder[0]).toBeLessThan(
      gh.run.mock.invocationCallOrder[gh.run.mock.calls.indexOf(create!)] ?? 0,
    );
    expect(useAppStore.getState().mountGithub[MOUNT_ID]?.pr?.number).toBe(418);
    expect(work()?.pullRequest).toEqual({
      number: 418,
      url: 'https://github.com/harborline/ledger-core/pull/418',
    });
  });
});

describe('when opening the pull request fails', () => {
  it('keeps the text and the reason, and opens the draft on Retry', async () => {
    rejectCreate({ stderr: 'GraphQL: Resource not accessible by personal access token' });

    await askAndSettle();

    expect(work()).toMatchObject({
      status: 'failed',
      error: 'GraphQL: Resource not accessible by personal access token',
      output: { prTitle: 'Guard settlement postings' },
    });
    expect(useAppStore.getState().mountGithub[MOUNT_ID]?.pr ?? null).toBeNull();

    acceptCreate();
    await useAppStore.getState().openScribePullRequest({ key: SCRIBE_KEY });

    expect(work()).toMatchObject({ status: 'created', error: null, pullRequest: { number: 418 } });
  });

  it('names a refused push and never reaches gh', async () => {
    gh.push.mockResolvedValueOnce({
      stdout: '',
      stderr: '! [rejected] fix/ledger-postings -> fix/ledger-postings (non-fast-forward)',
      exitCode: 1,
    });

    await askAndSettle();

    expect(work()?.status).toBe('failed');
    expect(work()?.error).toBe(
      "Couldn't push fix/ledger-postings: ! [rejected] fix/ledger-postings -> fix/ledger-postings (non-fast-forward)",
    );
    expect(createCall()).toBeUndefined();
  });
});

describe('talking to the Scribe after it wrote the text', () => {
  it('keeps the proposal when the answer brings no new text', async () => {
    await askAndSettle();

    await followUpToScribe({
      useAppStore,
      sessionId,
      answer: 'got it - PR text ready, engine creates the draft. standing by.',
      content: "didn't you create the PR?",
    });

    expect(work()).toMatchObject({
      status: 'created',
      output: { prTitle: 'Guard settlement postings' },
      pullRequest: { number: 418 },
    });
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

    expect(work()?.output).toMatchObject({
      prTitle: 'Guard settlement postings',
      prBody: 'Postings are keyed by event id.',
    });
  });

  it('opens the draft from a follow-up when the first try failed', async () => {
    rejectCreate({ stderr: 'gh: command not found' });
    await askAndSettle();
    expect(work()?.status).toBe('failed');

    acceptCreate();
    await followUpToScribe({
      useAppStore,
      sessionId,
      answer: '<<pr-title>>Guard every settlement posting<</pr-title>>',
      content: 'make the title stronger',
    });
    await settleScribeWork({ useAppStore });

    expect(work()).toMatchObject({ status: 'created', pullRequest: { number: 418 } });
    const args = createCall()?.[0] ?? [];
    expect(args[args.indexOf('--title') + 1]).toBe('Guard every settlement posting');
  });
});

describe('after the app reloads', () => {
  it('finds the blocks in the stored messages and opens the draft from the stored text', async () => {
    rejectCreate({ stderr: 'gh: command not found' });
    await askAndSettle();
    const agentId = scribeAgentIdOf({ useAppStore });

    const stored = await rowsOf<{ role: string; content: string }>({
      sql: "SELECT role, content FROM messages WHERE agent_id = ? AND role = 'assistant'",
      params: [agentId],
    });
    expect(stored.map((row) => extractScribeText(row.content).prTitle)).toContain(
      'Guard settlement postings',
    );

    await reloadScribeAgent({ useAppStore, sessionId });
    expect(work()).toBeUndefined();
    const reloaded = (useAppStore.getState().transcripts[agentId] ?? [])
      .flatMap((event) => (event.kind === 'assistant_text' ? [event.delta] : []))
      .join('');
    const output = extractScribeText(reloaded);
    expect(output.prBody).toBe('Retried batches no longer post twice.');

    acceptCreate();
    await useAppStore
      .getState()
      .resumeScribePullRequest({ sessionId, mountId: MOUNT_ID, agentId, output });

    expect(work()).toMatchObject({ status: 'created', pullRequest: { number: 418 } });
    expect(useAppStore.getState().scribeAgents[agentId]).toBe(SCRIBE_KEY);
  });

  it('opens a ready request on its custom base when Retry recovers both from the kickoff', async () => {
    rejectCreate({ stderr: 'gh: command not found' });
    storySpies.runTurn.mockImplementation(scribeTurn({ answer: PROPOSAL }));
    await askScribe({ useAppStore, sessionId, isDraft: false, base: 'release/0.19' });
    await settleScribeWork({ useAppStore });
    const agentId = await reloadScribeAgent({ useAppStore, sessionId });
    const items = reduceTranscript(useAppStore.getState().transcripts[agentId] ?? []);
    const proposal = scribeProposalOf({ items });
    expect(proposal?.kickoff).toContain('release/0.19');

    acceptCreate();
    await useAppStore.getState().resumeScribePullRequest({
      sessionId,
      mountId: MOUNT_ID,
      agentId,
      output: extractScribeText(proposal?.latestText ?? ''),
      kickoff: proposal?.kickoff ?? null,
    });

    expect(work()).toMatchObject({ status: 'created' });
    const args = createCalls().at(-1)?.[0] ?? [];
    expect(args).not.toContain('--draft');
    expect(args[args.indexOf('--base') + 1]).toBe('release/0.19');
  });
});
