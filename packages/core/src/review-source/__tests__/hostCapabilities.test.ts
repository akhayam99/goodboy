import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  HOST_CAPABILITIES,
  hostRowOf,
  hostsWithoutRow,
  isHostKind,
  type HostCapabilityRow,
} from '../hostCapabilities';
import { PULL_REQUEST_NOUNS } from '../pullRequestPort';
import { REVIEW_SOURCE_CAPABILITIES, REVIEW_SOURCE_LABEL } from '../types';

const PROTOCOL_RS = new URL(
  '../../../../../apps/desktop/src-tauri/src/query_bridge/protocol.rs',
  import.meta.url,
);

const VERB_SPEC = /provider: "([a-z]+)",\s+verb: "([a-z-]+)",/;

const PARAM_NAME = /\b(?:req|opt|num|opt_num|flag)\("([a-z-]+)"\)/g;

const ACCESS = /access: Access::(Read|Write|Publish)/;

type BridgeVerb = Readonly<{
  provider: string;
  verb: string;
  access: string;
  params: ReadonlyArray<string>;
}>;

const bridgeVerbs = (): ReadonlyArray<BridgeVerb> => {
  const source = readFileSync(PROTOCOL_RS, 'utf8');
  const catalog = source.slice(0, source.indexOf('#[cfg(test)]'));
  return catalog.split('VerbSpec {').flatMap((chunk) => {
    const head = VERB_SPEC.exec(chunk);
    if (head === null) {
      return [];
    }
    const paramsAt = chunk.indexOf('params:');
    const accessAt = chunk.indexOf('access:');
    return [
      {
        provider: head[1] ?? '',
        verb: head[2] ?? '',
        access: ACCESS.exec(chunk)?.[1] ?? '',
        params: Array.from(
          chunk.slice(paramsAt, accessAt).matchAll(PARAM_NAME),
          (match) => match[1] ?? '',
        ),
      },
    ];
  });
};

const HOSTS = ['github', 'gitlab', 'bitbucket'] as const;

const ROWS = HOSTS.map((host) => [host, HOST_CAPABILITIES[host]] as const);

const verbsOf = ({ row }: { readonly row: HostCapabilityRow }): ReadonlyArray<BridgeVerb> =>
  bridgeVerbs().filter((entry) => entry.provider === row.bridgeProvider);

describe('host capability table', () => {
  it('has one row per request host and no row for the local source', () => {
    const hosts = Object.keys(REVIEW_SOURCE_CAPABILITIES).filter((kind) => kind !== 'local');
    expect(Object.keys(HOST_CAPABILITIES).sort()).toEqual(hosts.sort());
    expect([...HOSTS].sort()).toEqual(hosts.sort());
    expect(isHostKind('local')).toBe(false);
  });

  it('names a host that has no row', () => {
    expect(hostsWithoutRow({ hosts: ['github', 'gitlab', 'bitbucket'] })).toEqual([]);
    expect(hostsWithoutRow({ hosts: ['github', 'forgejo', 'local'] })).toEqual([
      'forgejo',
      'local',
    ]);
  });

  it('refuses a prototype key as a host', () => {
    expect(isHostKind('constructor')).toBe(false);
    expect(isHostKind('__proto__')).toBe(false);
  });

  describe.each(ROWS)('row %s', (host, row) => {
    const capabilities = REVIEW_SOURCE_CAPABILITIES[host];

    it('agrees with the capability flags the sources claim', () => {
      expect(capabilities.canResolve).toBe(row.canResolveThreads);
      expect(capabilities.canReopen).toBe(row.canReopen);
      expect(capabilities.canSetDraft).toBe(row.draft !== 'none');
      expect(capabilities.canChooseMergeMethod).toBe(row.mergeMethods.length > 0);
    });

    it('pins a merge to the reviewed head on every host', () => {
      expect(row.canPinMergeToHead).toBe(true);
    });

    it('feeds the labels and nouns the app prints', () => {
      expect(REVIEW_SOURCE_LABEL[host]).toBe(row.label);
      expect(PULL_REQUEST_NOUNS[host]).toEqual(row.nouns);
    });

    it('keeps the url shapes distinct, slash bounded and free of the other hosts', () => {
      for (const segment of [row.requestSegment, row.commitSegment]) {
        expect(segment.startsWith('/')).toBe(true);
        expect(segment.endsWith('/')).toBe(true);
        expect(segment.includes('//')).toBe(false);
      }
      const others = ROWS.filter(([name]) => name !== host).map(([, other]) => other);
      expect(others.map((other) => other.requestSegment)).not.toContain(row.requestSegment);
      expect(others.map((other) => other.commitSegment)).not.toContain(row.commitSegment);
    });

    it('lists merge methods without a duplicate, inside the three the app knows', () => {
      for (const list of [row.mergeMethods, row.fallbackMergeMethods]) {
        expect(new Set(list).size).toBe(list.length);
        expect(list.every((method) => ['squash', 'merge', 'rebase'].includes(method))).toBe(true);
      }
      expect(row.mergeMethods).toEqual(expect.arrayContaining([...row.fallbackMergeMethods]));
    });

    it('exposes every verb it names in the query bridge catalog', () => {
      const catalog = verbsOf({ row });
      expect(catalog.length).toBeGreaterThan(0);
      const named = Object.entries(row.bridgeVerbs)
        .filter(([key]) => key !== 'mergeParam')
        .flatMap(([key, verb]) => (typeof verb === 'string' ? [[key, verb] as const] : []));
      for (const [key, verb] of named) {
        const entry = catalog.find((candidate) => candidate.verb === verb);
        expect(entry, `${host} ${key} verb ${verb}`).toBeDefined();
        if (key === 'forBranch') {
          expect(entry?.access).toBe('Read');
          continue;
        }
        expect(['Write', 'Publish']).toContain(entry?.access);
      }
    });

    it('offers no bridge verb for a capability the row denies', () => {
      const catalog = verbsOf({ row }).map((entry) => entry.verb);
      const denies: ReadonlyArray<readonly [string | null, RegExp]> = [
        [row.bridgeVerbs.resolve, /resolve/],
        [row.bridgeVerbs.ready, /ready/],
        [row.bridgeVerbs.create, /create$/],
      ];
      for (const [verb, pattern] of denies) {
        if (verb !== null) {
          continue;
        }
        const strays = catalog.filter(
          (name) => pattern.test(name) && !name.includes('comment') && !name.includes('note'),
        );
        expect(strays).toEqual([]);
      }
    });

    it('takes the merge choice through the parameter the row names', () => {
      const merge = verbsOf({ row }).find((entry) => entry.verb === row.bridgeVerbs.merge);
      const choice = merge?.params.filter((name) => ['method', 'strategy'].includes(name)) ?? [];
      expect(choice).toEqual(
        row.bridgeVerbs.mergeParam === null ? [] : [row.bridgeVerbs.mergeParam],
      );
    });

    it('reads the pull request back from its branch only if the row says so', () => {
      const hasBranchVerb = verbsOf({ row }).some(
        (entry) => entry.verb === row.bridgeVerbs.forBranch,
      );
      expect(hasBranchVerb).toBe(row.canReconcileByBranch);
    });
  });

  it.each([
    ['gitlab', 'gitlab.rs', 'pub async fn gitlab_merge_mr('],
    ['bitbucket', 'bitbucket.rs', 'pub async fn bitbucket_merge_pull_request('],
  ] as const)('takes the reviewed head in the %s merge command', (_host, file, signature) => {
    const source = readFileSync(
      new URL(`../../../../../apps/desktop/src-tauri/src/${file}`, import.meta.url),
      'utf8',
    );
    const start = source.indexOf(signature);
    expect(start).toBeGreaterThan(-1);
    const parameters = source.slice(start, source.indexOf(') ->', start));
    expect(parameters).toContain('expected_head_sha: Option<String>');
  });

  it('has a bridge provider that exists for every row and for no other host', () => {
    const providers = new Set(bridgeVerbs().map((entry) => entry.provider));
    for (const [, row] of ROWS) {
      expect(providers.has(row.bridgeProvider)).toBe(true);
    }
    expect(hostRowOf({ host: 'github' }).bridgeProvider).toBe('github');
  });

  it('does not let the bridge grow a pull request verb for a host without a row', () => {
    const hostLike = new Set(
      bridgeVerbs()
        .filter((entry) => /^(?:pr|mr)-/.test(entry.verb))
        .map((entry) => entry.provider),
    );
    expect(hostsWithoutRow({ hosts: Array.from(hostLike) })).toEqual([]);
  });
});
