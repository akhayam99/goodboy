import { describe, expect, it } from 'vitest';
import { listAutoDelegations } from '@goodboy/db';
import type { BranchFactsParts } from './ports';
import { BITBUCKET_MOUNT, CLEAN_FACTS, GITLAB_MOUNT, LEDGER_MOUNT } from './testing/fakePorts';
import {
  autoDelegates,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';

type HostCase = Readonly<{
  name: string;
  mount: typeof GITLAB_MOUNT;
  requestLine: string;
  checkLine: string;
  facts: BranchFactsParts;
}>;

const requestOf = ({
  host,
  url,
  headBranch,
}: {
  readonly host: 'gitlab' | 'bitbucket';
  readonly url: string;
  readonly headBranch: string;
}): BranchFactsParts['request'] => ({
  kind: 'ok',
  value: {
    host,
    number: 58,
    title: 'Retry failed payments',
    url,
    state: 'open',
    isDraft: false,
    baseBranch: 'main',
    headBranch,
  },
});

const GITLAB: HostCase = {
  name: 'a GitLab mount',
  mount: GITLAB_MOUNT,
  requestLine: 'Merge request: 58',
  checkLine: 'pipeline: success',
  facts: {
    ...CLEAN_FACTS,
    request: requestOf({
      host: 'gitlab',
      url: 'https://gitlab.com/harborline/payments-api/-/merge_requests/58',
      headBranch: GITLAB_MOUNT.branch,
    }),
    threads: {
      kind: 'ok',
      value: [
        { author: 'acme-dev', path: 'src/retry.ts', body: 'cap the delay', isResolved: false },
      ],
    },
    checks: { kind: 'ok', value: [{ name: 'pipeline', conclusion: 'success' }] },
  },
};

const BITBUCKET: HostCase = {
  name: 'a Bitbucket mount',
  mount: BITBUCKET_MOUNT,
  requestLine: 'Pull request: 58',
  checkLine: 'build: failure',
  facts: {
    ...CLEAN_FACTS,
    request: requestOf({
      host: 'bitbucket',
      url: 'https://bitbucket.org/harborline/acme-billing/pull-requests/58',
      headBranch: BITBUCKET_MOUNT.branch,
    }),
    threads: {
      kind: 'ok',
      value: [{ author: 'acme-dev', path: 'src/invoice.ts', body: 'name it', isResolved: false }],
    },
    checks: { kind: 'ok', value: [{ name: 'build', conclusion: 'failure' }] },
  },
};

const scoutOf = ({ mount }: { readonly mount: HostCase['mount'] }) => ({
  role: 'scout',
  task: 'report the open review threads',
  reason: 'a read of the branch state',
  mount: mount.id,
  facts: [mount.id],
});

const world = async ({ mount }: { readonly mount: HostCase['mount'] }): Promise<RuntimeWorld> => {
  const made = await makeRuntimeWorld({ capUsd: 10 });
  made.state.ports.setMounts([LEDGER_MOUNT, mount]);
  await userSays({ world: made, id: 'outbox-user-1', text: 'what is open on this branch' });
  return made;
};

const kickoffOf = async ({ made }: { readonly made: RuntimeWorld }): Promise<string> => {
  const [row] = await listAutoDelegations({ db: made.state.world.db, treeId: made.treeId });
  return String(row?.request['kickoff']);
};

describe.each([GITLAB, BITBUCKET])('a scout with facts on $name', (host) => {
  it('gets the request number, the open threads and the checks in its brief', async () => {
    const made = await world({ mount: host.mount });
    made.state.ports.setBranchFacts(host.mount.id, host.facts);
    await autoDelegates({ world: made, spec: { children: [scoutOf({ mount: host.mount })] } });
    const kickoff = await kickoffOf({ made });
    expect(kickoff).toContain(host.requestLine);
    expect(kickoff).toContain('Open review threads: 1');
    expect(kickoff).toContain('acme-dev');
    expect(kickoff).toContain(host.checkLine);
    expect(made.state.ports.factReads).toEqual([
      {
        sessionId: expect.any(String),
        mountId: host.mount.id,
        worktreePath: host.mount.worktreePath,
        branch: host.mount.branch,
      },
    ]);
  });

  it('marks a host read error in the brief and still starts the scout', async () => {
    const made = await world({ mount: host.mount });
    made.state.ports.setBranchFacts(
      host.mount.id,
      new Error('the host connection is not signed in'),
    );
    const outcome = await autoDelegates({
      world: made,
      spec: { children: [scoutOf({ mount: host.mount })] },
    });
    expect(outcome).toMatchObject({ isOk: true });
    expect(await kickoffOf({ made })).toContain(
      'Commits: Facts not available: the host connection is not signed in',
    );
  });
});
