import { describe, expect, it } from 'vitest';
import { composeBranchFacts, type BranchFacts } from './branchFacts';
import { composeDelegationKickoff } from './kickoff';
import { parseDelegateSpec } from './delegateSpec';
import {
  AUTO_FACTS_CHARS,
  AUTO_FACTS_COMMITS_MAX,
  AUTO_FACTS_MOUNTS_MAX,
  AUTO_FACTS_THREADS_MAX,
} from './limits';
import { roleCannotRunCommandsMessage, rerouteHintOf } from './roleTools';

const FULL: BranchFacts = {
  mountLabel: 'mount-ledger-core (ledger-core, branch ak/ledger-export)',
  commits: { kind: 'ok', value: [{ sha: 'abcdef1234567', subject: 'feat: export the ledger' }] },
  request: {
    kind: 'ok',
    value: {
      host: 'github',
      number: 421,
      title: 'Export the ledger',
      url: 'https://github.com/harborline/ledger-core/pull/421',
      state: 'open',
      isDraft: false,
      baseBranch: 'main',
      headBranch: 'ak/ledger-export',
    },
  },
  threads: {
    kind: 'ok',
    value: [
      { author: 'northwind-bot', path: 'src/ledger.ts', body: 'rename this', isResolved: false },
      { author: 'acme-dev', path: null, body: 'done already', isResolved: true },
    ],
  },
  checks: { kind: 'ok', value: [{ name: 'ci', conclusion: 'success' }] },
};

const specOf = (child: Record<string, unknown>) =>
  parseDelegateSpec({ text: JSON.stringify({ children: [child] }) });

describe('composeBranchFacts', () => {
  it('writes commits, the request, open threads and checks', () => {
    const text = composeBranchFacts({ facts: [FULL] }) ?? '';
    expect(text).toContain('Commits since the base: 1');
    expect(text).toContain('abcdef123 feat: export the ledger');
    expect(text).toContain(
      'Pull request: 421 "Export the ledger" (open, ak/ledger-export into main)',
    );
    expect(text).toContain('Open review threads: 1');
    expect(text).toContain('src/ledger.ts: northwind-bot: rename this');
    expect(text).not.toContain('done already');
    expect(text).toContain('ci: success');
  });

  it('names a merge request on gitlab', () => {
    const request = FULL.request.kind === 'ok' ? FULL.request.value : null;
    const text =
      composeBranchFacts({
        facts: [
          {
            ...FULL,
            request: {
              kind: 'ok',
              value: request === null ? null : { ...request, host: 'gitlab', isDraft: true },
            },
          },
        ],
      }) ?? '';
    expect(text).toContain('Merge request: 421');
    expect(text).toContain('open, draft');
  });

  it('says none is open when the branch has no request', () => {
    const text =
      composeBranchFacts({ facts: [{ ...FULL, request: { kind: 'ok', value: null } }] }) ?? '';
    expect(text).toContain('none is open for this branch');
  });

  it('marks a failed part and keeps the others', () => {
    const text =
      composeBranchFacts({
        facts: [{ ...FULL, checks: { kind: 'unavailable', reason: 'gh timed out' } }],
      }) ?? '';
    expect(text).toContain('Checks: Facts not available: gh timed out');
    expect(text).toContain('Commits since the base: 1');
  });

  it('returns null for no mounts', () => {
    expect(composeBranchFacts({ facts: [] })).toBeNull();
  });

  it('caps the items of one list and counts the rest', () => {
    const commits = Array.from({ length: AUTO_FACTS_COMMITS_MAX + 5 }, (_, index) => ({
      sha: `sha${index}`.padEnd(9, '0'),
      subject: `commit ${index}`,
    }));
    const text = composeBranchFacts({
      facts: [{ ...FULL, commits: { kind: 'ok', value: commits } }],
    });
    expect(text).toContain(`Commits since the base: ${AUTO_FACTS_COMMITS_MAX + 5}`);
    expect(text).toContain('and 5 more');
    const threads = Array.from({ length: AUTO_FACTS_THREADS_MAX + 2 }, (_, index) => ({
      author: 'acme-dev',
      path: null,
      body: `thread ${index}`,
      isResolved: false,
    }));
    expect(
      composeBranchFacts({ facts: [{ ...FULL, threads: { kind: 'ok', value: threads } }] }),
    ).toContain('and 2 more');
  });

  it('keeps the whole text under the cap and marks the cut', () => {
    const body = 'x'.repeat(200);
    const commits = Array.from({ length: 40 }, (_, index) => ({
      sha: `${index}`.padEnd(9, '0'),
      subject: body,
    }));
    const facts = Array.from({ length: AUTO_FACTS_MOUNTS_MAX }, () => ({
      ...FULL,
      commits: { kind: 'ok', value: commits } as const,
    }));
    const text = composeBranchFacts({ facts }) ?? '';
    expect(text).toContain('[facts cut: the cap was reached]');
    expect(text.length).toBeLessThanOrEqual(AUTO_FACTS_CHARS + 400);
  });

  it('writes no em or en dash', () => {
    const dashes = [String.fromCharCode(8211), String.fromCharCode(8212)];
    const text = composeBranchFacts({ facts: [FULL] }) ?? '';
    expect(dashes.some((dash) => text.includes(dash))).toBe(false);
  });
});

describe('the facts field of a delegate spec', () => {
  const scout = { role: 'scout', task: 'Report the open threads.', reason: 'Facts read.' };

  it('reads mount ids and cuts the list at the cap', () => {
    const outcome = specOf({
      ...scout,
      facts: ['m1', 'm2', 'm3', 'm4', 'm5', 'm1'],
    });
    expect(outcome.kind === 'ok' ? outcome.children[0]?.facts : null).toEqual([
      'm1',
      'm2',
      'm3',
      'm4',
    ]);
  });

  it('defaults to none and leaves the hash of an earlier spec as it was', () => {
    const plain = specOf(scout);
    const empty = specOf({ ...scout, facts: [] });
    expect(plain.kind === 'ok' && empty.kind === 'ok' ? plain.hash === empty.hash : null).toBe(
      true,
    );
    const named = specOf({ ...scout, facts: ['m1'] });
    expect(named.kind === 'ok' && plain.kind === 'ok' ? named.hash !== plain.hash : null).toBe(
      true,
    );
  });

  it('refuses facts on a retry', () => {
    const outcome = specOf({ retryOf: 'delegation-1', reason: 'again', facts: ['m1'] });
    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' ? outcome.message : '').toContain('facts cannot be set');
  });
});

describe('the facts section of a kickoff', () => {
  const base = {
    role: 'scout',
    childAgentId: 'agent-1',
    task: 'Report.',
    doneWhen: null,
    expected: null,
    inputs: [],
    revise: null,
    mountLabel: 'mount-ledger-core',
  } as const;

  it('sits after the mount and before the task', () => {
    const facts = composeBranchFacts({ facts: [FULL] });
    const text = composeDelegationKickoff({ ...base, facts });
    expect(text.indexOf('**Mount**')).toBeLessThan(text.indexOf('**Facts**'));
    expect(text.indexOf('**Facts**')).toBeLessThan(text.indexOf('**Task**'));
  });

  it('is absent without facts', () => {
    expect(composeDelegationKickoff(base)).not.toContain('**Facts**');
  });
});

describe('the reroute hint', () => {
  it('sends branch facts to a scout', () => {
    expect(rerouteHintOf({ role: 'scout' })).toContain('facts');
    expect(roleCannotRunCommandsMessage({ role: 'scout' })).toContain('"facts"');
  });
});
