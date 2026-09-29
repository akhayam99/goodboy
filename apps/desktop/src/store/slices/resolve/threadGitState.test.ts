import { describe, expect, it, vi } from 'vitest';
import type { PrComment, ResolveThread, SessionId } from '@goodboy/types';
import {
  computeThreadGitFacts,
  handleOf,
  handledByLine,
  remoteKindOf,
  type ThreadGitPorts,
} from './threadGitState';

const COMMENT_AT = Date.parse('2026-09-28T09:00:00Z');

const rowOf = (overrides: Partial<ResolveThread>): ResolveThread => ({
  id: 'row',
  sessionId: 'session' as SessionId,
  projectId: null,
  prNumber: 318,
  threadId: 'PRRT_1',
  originKind: 'review_comment',
  diffCommentId: null,
  state: 'fixed',
  stage: 'approved',
  stateReason: null,
  revision: 1,
  generation: 0,
  reopenedFromThreadId: null,
  activeAttemptId: null,
  disposition: 'fix',
  replyDraft: 'Fixed in c81e5aa',
  commitShas: ['c81e5aa0000000000000000000000000000000aa'],
  fixupOfSha: null,
  replacesSha: null,
  question: null,
  replyPostedAt: null,
  replyId: null,
  githubResolved: null,
  closedAt: null,
  closedSource: null,
  createdAt: COMMENT_AT + 60_000,
  updatedAt: COMMENT_AT + 60_000,
  ...overrides,
});

const commentOf = (overrides: Partial<PrComment>): PrComment => ({
  id: 'c1',
  author: 'iokafor',
  authorAvatarUrl: null,
  body: 'Same loop should emit a metric',
  createdAt: new Date(COMMENT_AT).toISOString(),
  url: 'https://example.test/c1',
  source: 'review',
  path: 'src/metrics.ts',
  line: 18,
  threadId: 'PRRT_1',
  ...overrides,
});

const ports = (overrides: Partial<ThreadGitPorts>): ThreadGitPorts => ({
  fixOnOrigin: async () => ({ onOrigin: false, landedAs: null }),
  isOnLocalHead: async () => true,
  locateFix: async () => ({ isKnown: true, landedAs: null, pathExists: null }),
  commitsTouching: async () => [],
  ...overrides,
});

const base = {
  comments: [commentOf({})],
  viewerLogins: new Set(['mquint']),
  ownShas: new Set<string>(),
  branch: 'hl/fix-duplicate-credit',
  isDismissed: () => false,
};

const theo = {
  sha: '5d21a0e0000000000000000000000000000000ab',
  author: 'Theo Varga',
  email: 'tvarga@harborline.test',
  subject: 'Emit the retry metric',
  committedAt: Math.floor(COMMENT_AT / 1000) + 3000,
};

describe('computeThreadGitFacts', () => {
  it('leaves a sha that is only local in the local state, so it is pushed', async () => {
    const facts = await computeThreadGitFacts({ ...base, row: rowOf({}), ports: ports({}) });
    expect(facts.gitState).toBe('local');
    expect(remoteKindOf({ facts })).toBeNull();
  });

  it('marks a fix sha that is on origin so it leaves the push', async () => {
    const facts = await computeThreadGitFacts({
      ...base,
      row: rowOf({}),
      ports: ports({ fixOnOrigin: async () => ({ onOrigin: true, landedAs: null }) }),
    });
    expect(facts.gitState).toBe('on_origin');
    expect(facts.onOrigin?.branch).toBe('hl/fix-duplicate-credit');
    expect(remoteKindOf({ facts })).toBe('on_origin');
  });

  it('needs every sha of the thread on origin before it counts as pushed', async () => {
    const facts = await computeThreadGitFacts({
      ...base,
      row: rowOf({ commitShas: ['aaaaaaa', 'bbbbbbb'] }),
      ports: ports({
        fixOnOrigin: async ({ sha }) => ({ onOrigin: sha === 'aaaaaaa', landedAs: null }),
      }),
    });
    expect(facts.gitState).toBe('local');
  });

  it('calls a cherry-picked equivalent fixed elsewhere', async () => {
    const facts = await computeThreadGitFacts({
      ...base,
      row: rowOf({}),
      ports: ports({ fixOnOrigin: async () => ({ onOrigin: false, landedAs: 'f00ba12' }) }),
    });
    expect(facts.gitState).toBe('fixed_elsewhere');
    expect(facts.elsewhere?.sha).toBe('f00ba12');
    expect(facts.elsewhere?.origin).toBe('cherry');
  });

  it('flags a fix that is neither on origin nor on the local branch', async () => {
    const facts = await computeThreadGitFacts({
      ...base,
      row: rowOf({}),
      ports: ports({ isOnLocalHead: async () => false }),
    });
    expect(facts.gitState).toBe('missing');
    expect(remoteKindOf({ facts })).toBe('missing');
  });

  it('reads a missing fix as folded when the same patch sits on the branch under another sha', async () => {
    const locateFix = vi.fn(async () => ({
      isKnown: true,
      landedAs: 'e31b9f4',
      pathExists: true,
    }));
    const facts = await computeThreadGitFacts({
      ...base,
      row: rowOf({}),
      ports: ports({ isOnLocalHead: async () => false, locateFix }),
    });
    expect(facts.gitState).toBe('folded');
    expect(facts.folded).toEqual({
      sha: 'c81e5aa0000000000000000000000000000000aa',
      landedAs: 'e31b9f4',
    });
    expect(facts.missing).toBeNull();
    expect(remoteKindOf({ facts })).toBe('folded');
    expect(locateFix).toHaveBeenCalledWith({
      sha: 'c81e5aa0000000000000000000000000000000aa',
      path: 'src/metrics.ts',
    });
  });

  it('keeps a fix missing when only some of its shas were folded, and notes a gone file', async () => {
    const facts = await computeThreadGitFacts({
      ...base,
      row: rowOf({ commitShas: ['aaaaaaa', 'bbbbbbb'] }),
      ports: ports({
        isOnLocalHead: async () => false,
        locateFix: async ({ sha }) => ({
          isKnown: true,
          landedAs: sha === 'aaaaaaa' ? 'e31b9f4' : null,
          pathExists: false,
        }),
      }),
    });
    expect(facts.gitState).toBe('missing');
    expect(facts.missing).toEqual({ sha: 'bbbbbbb', wasPushed: false, isPathGone: true });
  });

  it('flags a pushed fix that origin no longer has', async () => {
    const pushed = rowOf({ replyPostedAt: COMMENT_AT + 120_000, state: 'fixed' });
    const facts = await computeThreadGitFacts({
      ...base,
      row: pushed,
      ports: ports({ fixOnOrigin: async () => ({ onOrigin: false, landedAs: null }) }),
    });
    expect(facts.gitState).toBe('missing');
    expect(facts.missing?.wasPushed).toBe(true);
    expect(remoteKindOf({ facts })).toBe('missing');
  });

  it('leaves a pushed fix alone while origin has it or an equivalent', async () => {
    const pushed = rowOf({ replyPostedAt: COMMENT_AT + 120_000, state: 'fixed' });
    const onOrigin = await computeThreadGitFacts({
      ...base,
      row: pushed,
      ports: ports({ fixOnOrigin: async () => ({ onOrigin: true, landedAs: null }) }),
    });
    const landed = await computeThreadGitFacts({
      ...base,
      row: pushed,
      ports: ports({ fixOnOrigin: async () => ({ onOrigin: false, landedAs: 'f00ba12' }) }),
    });
    expect(onOrigin.gitState).toBe('local');
    expect(landed.gitState).toBe('local');
  });

  it('does not flag a fix as missing when git cannot answer', async () => {
    const facts = await computeThreadGitFacts({
      ...base,
      row: rowOf({}),
      ports: ports({
        fixOnOrigin: async () => {
          throw new Error('offline');
        },
        isOnLocalHead: async () => {
          throw new Error('offline');
        },
      }),
    });
    expect(facts.gitState).toBe('local');
  });

  describe('looks fixed', () => {
    const open = rowOf({ state: 'open', stage: 'proposed', disposition: null, commitShas: null });

    it('shows the commit and its author when someone else changed the commented lines', async () => {
      const facts = await computeThreadGitFacts({
        ...base,
        row: open,
        ports: ports({ commitsTouching: async () => [theo] }),
      });
      expect(facts.gitState).toBe('fixed_elsewhere');
      expect(facts.elsewhere).toMatchObject({
        sha: theo.sha,
        author: 'Theo Varga',
        handle: 'tvarga',
        path: 'src/metrics.ts',
        line: 18,
        origin: 'commit',
      });
      expect(remoteKindOf({ facts })).toBe('looks_fixed');
      expect(handledByLine({ fix: facts.elsewhere! })).toBe('Handled in 5d21a0e by @tvarga.');
    });

    it('asks git only about commits after the comment, on the commented line', async () => {
      const seen: Array<unknown> = [];
      await computeThreadGitFacts({
        ...base,
        row: open,
        ports: ports({
          commitsTouching: async (params) => {
            seen.push(params);
            return [];
          },
        }),
      });
      expect(seen).toEqual([
        { path: 'src/metrics.ts', line: 18, sinceSecs: Math.floor(COMMENT_AT / 1000) },
      ]);
    });

    it('ignores commits Goodboy made itself', async () => {
      const facts = await computeThreadGitFacts({
        ...base,
        ownShas: new Set([theo.sha]),
        row: open,
        ports: ports({ commitsTouching: async () => [theo] }),
      });
      expect(facts.gitState).toBe('local');
    });

    it('stays quiet after the reviewer chose Fix anyway', async () => {
      const facts = await computeThreadGitFacts({
        ...base,
        isDismissed: ({ sha }) => sha === theo.sha,
        row: open,
        ports: ports({ commitsTouching: async () => [theo] }),
      });
      expect(facts.gitState).toBe('local');
    });

    it('does not probe a thread whose fix is already drafted into the branch', async () => {
      const facts = await computeThreadGitFacts({
        ...base,
        row: rowOf({}),
        ports: ports({
          commitsTouching: async () => {
            throw new Error('must not be called');
          },
        }),
      });
      expect(facts.gitState).toBe('local');
    });

    it('does not probe a comment without a line', async () => {
      const facts = await computeThreadGitFacts({
        ...base,
        comments: [commentOf({ line: undefined })],
        row: open,
        ports: ports({ commitsTouching: async () => [theo] }),
      });
      expect(facts.gitState).toBe('local');
    });
  });

  describe('you already replied', () => {
    const reply = commentOf({
      id: 'hand',
      author: 'MQuint',
      body: 'Done, thanks',
      createdAt: new Date(COMMENT_AT + 120_000).toISOString(),
    });

    it('recognises a hand-written reply after the draft, whatever its text', async () => {
      const facts = await computeThreadGitFacts({
        ...base,
        comments: [commentOf({}), reply],
        row: rowOf({}),
        ports: ports({}),
      });
      expect(facts.userReply?.commentId).toBe('hand');
      expect(remoteKindOf({ facts })).toBe('you_replied');
    });

    it('wins over the git state, since nothing should be posted', async () => {
      const facts = await computeThreadGitFacts({
        ...base,
        comments: [commentOf({}), reply],
        row: rowOf({}),
        ports: ports({ fixOnOrigin: async () => ({ onOrigin: true, landedAs: null }) }),
      });
      expect(facts.gitState).toBe('on_origin');
      expect(remoteKindOf({ facts })).toBe('you_replied');
    });

    it('ignores a reply that came before the draft or that Goodboy posted', async () => {
      const early = commentOf({
        id: 'early',
        author: 'mquint',
        createdAt: new Date(COMMENT_AT + 10_000).toISOString(),
      });
      const posted = await computeThreadGitFacts({
        ...base,
        comments: [commentOf({}), reply],
        row: rowOf({ replyId: 'hand' }),
        ports: ports({}),
      });
      const before = await computeThreadGitFacts({
        ...base,
        comments: [commentOf({}), early],
        row: rowOf({}),
        ports: ports({}),
      });
      expect(posted.userReply).toBeNull();
      expect(before.userReply).toBeNull();
    });

    it('ignores replies written by someone else', async () => {
      const facts = await computeThreadGitFacts({
        ...base,
        comments: [commentOf({}), commentOf({ ...reply, author: 'tvarga' })],
        row: rowOf({}),
        ports: ports({}),
      });
      expect(facts.userReply).toBeNull();
    });
  });

  it('leaves settled threads alone', async () => {
    const facts = await computeThreadGitFacts({
      ...base,
      row: rowOf({ state: 'closed' }),
      ports: ports({ fixOnOrigin: async () => ({ onOrigin: true, landedAs: null }) }),
    });
    expect(facts.gitState).toBe('local');
  });
});

describe('handleOf', () => {
  it('reads the login out of a noreply address and falls back to the local part', () => {
    expect(handleOf({ email: '1234+tvarga@users.noreply.github.com' })).toBe('tvarga');
    expect(handleOf({ email: 'tvarga@harborline.test' })).toBe('tvarga');
    expect(handleOf({ email: '' })).toBeNull();
  });
});
