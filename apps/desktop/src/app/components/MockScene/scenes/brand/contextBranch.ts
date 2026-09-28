import type { BranchCommit, WorktreeStatus } from '@goodboy/types';
import { BRAND_PEOPLE, BRAND_SESSION } from './canon';

const secondsAgo = (minutes: number): number => Math.floor(Date.now() / 1000) - minutes * 60;

type CommitSeed = Readonly<{
  sha: string;
  subject: string;
  author: string;
  minutes: number;
  pushed: boolean;
}>;

const SEEDS: ReadonlyArray<CommitSeed> = [
  {
    sha: 'e41c07b9d2a84f6e1b3c5d7f9a0b2c4d6e8f1a3b',
    subject: 'fixup! Reject a second posting for the same event id',
    author: 'Goodboy',
    minutes: 64,
    pushed: false,
  },
  {
    sha: 'c9a2f5e81b7d4c3a6f0e9d8c7b6a5f4e3d2c1b0a',
    subject: 'Reject a second posting for the same event id',
    author: 'Goodboy',
    minutes: 118,
    pushed: false,
  },
  {
    sha: '7b3e9d1c5a2f8e4b6d0c9a7f5e3b1d8c6a4f2e0b',
    subject: 'fixup! Dedupe on the event id inside the credit transaction',
    author: BRAND_PEOPLE.owner.name,
    minutes: 150,
    pushed: false,
  },
  {
    sha: '3f8d2a6c9e1b5d7f0a4c8e2b6d9f1a3c5e7b9d0f',
    subject: 'Dedupe on the event id inside the credit transaction',
    author: 'Goodboy',
    minutes: 190,
    pushed: true,
  },
  {
    sha: 'a5c1e7b3d9f2a6c0e4b8d1f5a9c3e7b0d4f8a2c6',
    subject: 'Keep the processor event id on every credit row',
    author: 'Goodboy',
    minutes: 250,
    pushed: true,
  },
];

export const CTX_BASE_SHA = '9d4b1f7a3c8e2d6b0f5a9c1e7d3b8f2a6c0e4d9b';

export const CTX_COMMITS: ReadonlyArray<BranchCommit> = SEEDS.map((seed, index) => ({
  sha: seed.sha,
  shortSha: seed.sha.slice(0, 7),
  subject: seed.subject,
  author: seed.author,
  timestamp: secondsAgo(seed.minutes),
  pushed: seed.pushed,
  parentSha: SEEDS[index + 1]?.sha ?? CTX_BASE_SHA,
}));

export const CTX_STATUS: WorktreeStatus = {
  branch: BRAND_SESSION.branch,
  head: CTX_COMMITS[0]?.sha ?? null,
  headSubject: CTX_COMMITS[0]?.subject ?? null,
  upstreamDistance: { kind: 'known', ahead: 3, behind: 0 },
  mainDistance: { kind: 'known', ahead: CTX_COMMITS.length, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: `origin/${BRAND_SESSION.branch}`,
  inProgress: null,
};
