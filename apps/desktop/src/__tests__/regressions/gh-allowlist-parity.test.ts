// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  addReviewThreadReply,
  createGithubRepo,
  createIssueComment,
  detectRepoSlug,
  listAssignedIssues,
  listIssueComments,
  listOpenPrBranches,
  listPrsForBranch,
  resolvePrForBranch,
  resolveReviewThread,
  updateIssueBody,
  updateReviewComment,
  viewPullRequest,
  type GhRunner,
} from '@goodboy/core';
import { describe, expect, it } from 'vitest';

type Flag = {
  readonly name: string;
  readonly slot?: string | null;
  readonly values?: ReadonlyArray<string>;
  readonly isRepeatable?: boolean;
  readonly isRequired?: boolean;
};

type Shape = {
  readonly id: string;
  readonly verb: ReadonlyArray<string>;
  readonly positional: ReadonlyArray<string>;
  readonly flags: ReadonlyArray<Flag>;
  readonly tail?: string;
  readonly isGraphql?: boolean;
};

type Allowlist = {
  readonly mutations: ReadonlyArray<string>;
  readonly shapes: ReadonlyArray<Shape>;
};

type ArgsParams = { readonly args: ReadonlyArray<string> };

const ALLOWLIST_PATH = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'src-tauri',
  'gh-allowlist.json',
);

const allowlist: Allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'));

const WORD = /^[A-Za-z0-9._-]+$/;
const SLOT_PATTERN: Readonly<Record<string, string>> = {
  number: '\\d{1,10}',
  sha: '[0-9a-fA-F]{7,64}',
  slug: '[A-Za-z0-9._-]+/[A-Za-z0-9._-]+',
  word: '[A-Za-z0-9._-]+',
};

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

const templateMatches = ({ template, value }: { template: string; value: string }): boolean => {
  if (template === '{ref}') {
    return (
      /^\d{1,10}$/.test(value) ||
      /^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\/pull\/\d{1,10}$/.test(value)
    );
  }
  const source = template
    .split(/(\{[a-z]+\})/)
    .map((part) => {
      const slot = SLOT_PATTERN[part.slice(1, -1)];
      return part.startsWith('{') && slot !== undefined ? slot : escapeRegExp(part);
    })
    .join('');
  return new RegExp(`^${source}$`).test(value);
};

const slotMatches = ({ slot, value }: { slot: string; value: string }): boolean => {
  switch (slot) {
    case 'number':
      return /^\d{1,10}$/.test(value);
    case 'slug':
      return templateMatches({ template: '{slug}', value });
    case 'word':
      return WORD.test(value);
    case 'sha':
      return /^[0-9a-fA-F]{7,64}$/.test(value);
    case 'fields':
      return /^[A-Za-z]+(,[A-Za-z]+)*$/.test(value);
    case 'text':
      return !value.includes('\0');
    default:
      return false;
  }
};

const flagValueMatches = ({ flag, value }: { flag: Flag; value: string }): boolean => {
  if (flag.values !== undefined) {
    return flag.values.includes(value);
  }
  if (flag.slot === 'assignment') {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=([\s\S]*)$/.exec(value);
    return match !== null && !(flag.name === '-F' && (match[2] ?? '').startsWith('@'));
  }
  return flag.slot != null && slotMatches({ slot: flag.slot, value });
};

const queryIsAllowed = ({ query }: { query: string }): boolean => {
  const calls = [...query.matchAll(/([A-Za-z0-9_]+)\(input:/g)].map((match) => match[1] ?? '');
  const words = query.split(/[^A-Za-z0-9_]+/);
  const isMutationText = words.includes('mutation') || words.includes('subscription');
  if (!isMutationText) {
    return calls.length === 0;
  }
  return (
    query.trimStart().startsWith('mutation') &&
    calls.length > 0 &&
    calls.every((call) => allowlist.mutations.includes(call))
  );
};

type ShapeParams = { readonly shape: Shape; readonly args: ReadonlyArray<string> };

const shapeAccepts = ({ shape, args }: ShapeParams): boolean => {
  if (shape.verb.some((word, index) => args[index] !== word)) {
    return false;
  }
  const positionals: string[] = [];
  const seen: string[] = [];
  let query: string | null = null;
  let index = shape.verb.length;
  while (index < args.length) {
    const token = args[index] ?? '';
    if (token === '--') {
      if (shape.tail === undefined || index + 2 !== args.length) {
        return false;
      }
      break;
    }
    if (!token.startsWith('-') || token === '-') {
      positionals.push(token);
      index += 1;
      continue;
    }
    const flag = shape.flags.find((candidate) => candidate.name === token);
    if (flag === undefined || (flag.isRepeatable !== true && seen.includes(flag.name))) {
      return false;
    }
    seen.push(flag.name);
    if (flag.slot === null && flag.values === undefined) {
      index += 1;
      continue;
    }
    const value = args[index + 1];
    if (value === undefined || !flagValueMatches({ flag, value })) {
      return false;
    }
    if (shape.isGraphql === true && value.startsWith('query=')) {
      if (flag.name !== '-f' || query !== null) {
        return false;
      }
      query = value.slice('query='.length);
    }
    index += 2;
  }
  const isEveryRequiredSeen = shape.flags
    .filter((flag) => flag.isRequired === true)
    .every((flag) => seen.includes(flag.name));
  const requiredCount = shape.positional.filter((template) => !template.endsWith('?')).length;
  if (
    !isEveryRequiredSeen ||
    positionals.length < requiredCount ||
    positionals.length > shape.positional.length
  ) {
    return false;
  }
  const isEachPositionalMatching = positionals.every((value, position) =>
    templateMatches({
      template: (shape.positional[position] ?? '').replace(/\?$/, ''),
      value,
    }),
  );
  if (!isEachPositionalMatching) {
    return false;
  }
  return shape.isGraphql === true ? query !== null && queryIsAllowed({ query }) : true;
};

const isAllowed = ({ args }: ArgsParams): boolean =>
  !args.some((arg) =>
    ['--hostname', '--input', 'GH_HOST'].some((prefix) => arg.startsWith(prefix)),
  ) && allowlist.shapes.some((shape) => shapeAccepts({ shape, args }));

const recordingRunner = (): { readonly runner: GhRunner; readonly calls: string[][] } => {
  const calls: string[][] = [];
  const runner: GhRunner = {
    run: async (args) => {
      calls.push([...args]);
      return { stdout: '', stderr: 'recorded', exitCode: 1 };
    },
  };
  return { runner, calls };
};

describe('gh allowlist parity', () => {
  it('lists each shape once and keeps every mutation named', () => {
    const ids = allowlist.shapes.map((shape) => shape.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(allowlist.mutations.length).toBeGreaterThan(0);
  });

  it('accepts every argv the core GitHub callers build', async () => {
    const { runner, calls } = recordingRunner();
    const opts = { cwd: '/work/ledger-core' };
    const attempts: ReadonlyArray<Promise<unknown>> = [
      resolvePrForBranch(runner, 'acme/ledger-core', 'feat/x', opts),
      viewPullRequest({ runner, repo: 'acme/ledger-core', number: 12, opts }),
      listPrsForBranch(runner, 'acme/ledger-core', 'feat/x', opts),
      detectRepoSlug(runner, '/work/ledger-core'),
      createGithubRepo({ runner, name: 'payments-api', owner: 'acme', visibility: 'private' }),
      listAssignedIssues(runner, 'acme/ledger-core', opts),
      listOpenPrBranches({ runner, repoSlug: 'acme/ledger-core', opts }),
      listIssueComments({ runner, repoSlug: 'acme/ledger-core', issueNumber: 7, opts }),
      createIssueComment({
        runner,
        repoSlug: 'acme/ledger-core',
        issueNumber: 7,
        body: 'Hi',
        opts,
      }),
      updateIssueBody({ runner, repoSlug: 'acme/ledger-core', issueNumber: 7, body: 'New', opts }),
      resolveReviewThread(runner, 'PRRT_1', opts),
      addReviewThreadReply(runner, 'PRRT_1', 'Done', opts),
      updateReviewComment(runner, 'PRRC_1', 'Edited', opts),
    ];
    await Promise.allSettled(attempts);
    expect(calls.length).toBeGreaterThanOrEqual(attempts.length);
    for (const args of calls) {
      expect(isAllowed({ args }), args.join(' ').slice(0, 120)).toBe(true);
    }
  });

  it('refuses what Rust refuses', () => {
    expect(isAllowed({ args: ['pr', 'view', '12', '--hostname', 'evil.example'] })).toBe(false);
    expect(isAllowed({ args: ['api', 'graphql', '--input', '-'] })).toBe(false);
    expect(isAllowed({ args: ['auth', 'token'] })).toBe(false);
    expect(
      isAllowed({
        args: [
          'api',
          'graphql',
          '-f',
          'query=mutation($id:ID!){ mergePullRequest(input:{pullRequestId:$id}){ clientMutationId } }',
        ],
      }),
    ).toBe(false);
  });
});
