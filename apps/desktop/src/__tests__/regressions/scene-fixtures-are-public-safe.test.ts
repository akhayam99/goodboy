// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const MOCK_SCENE_ROOT = join(__dirname, '..', '..', 'app', 'components', 'MockScene');

const HOME_PATH = /\/Users\/|\/home\/|[A-Za-z]:\\\\Users/;

const TOKEN_SHAPE =
  /\bsk-ant-|\bsk-[A-Za-z0-9]{20}|\bghp_|\bgho_|\bgithub_pat_|\bxox[abprs]-|\bAKIA[0-9A-Z]{16}/;

const EMAIL_DOMAIN = /[A-Za-z0-9._%+-]@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;

const LETTERS_ONLY = /^[a-z]{2,}$/;

const MOCK_DOMAIN_LABELS: ReadonlySet<string> = new Set([
  'harborline',
  'northwind',
  'acme',
  'cascadia',
  'example',
]);

const RESERVED_TOP_LEVELS: ReadonlySet<string> = new Set(['test', 'invalid', 'example']);

const GIT_REMOTE_HOSTS: ReadonlySet<string> = new Set([
  'github.com',
  'gitlab.com',
  'bitbucket.org',
]);

type ListParams = {
  readonly dir: string;
};

type DomainParams = {
  readonly domain: string;
};

type LineParams = {
  readonly line: string;
};

type OffensesParams = {
  readonly matches: ({ line }: LineParams) => boolean;
};

const listFixtureFiles = ({ dir }: ListParams): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return listFixtureFiles({ dir: full });
    }
    const isSource = entry.endsWith('.ts') || entry.endsWith('.tsx');
    const isTest = entry.includes('.test.');
    return isSource && !isTest ? [full] : [];
  });

const isMockDomain = ({ domain }: DomainParams): boolean => {
  const labels = domain.toLowerCase().split('.');
  const topLevel = labels[labels.length - 1] ?? '';
  const secondLevel = labels[labels.length - 2] ?? '';
  const isVersion = !LETTERS_ONLY.test(topLevel);
  if (isVersion || GIT_REMOTE_HOSTS.has(labels.slice(-2).join('.'))) {
    return true;
  }
  return RESERVED_TOP_LEVELS.has(topLevel) || MOCK_DOMAIN_LABELS.has(secondLevel);
};

const hasHomePath = ({ line }: LineParams): boolean => HOME_PATH.test(line);

const hasTokenShape = ({ line }: LineParams): boolean => TOKEN_SHAPE.test(line);

const hasRealEmail = ({ line }: LineParams): boolean =>
  [...line.matchAll(EMAIL_DOMAIN)].some((match) => !isMockDomain({ domain: match[1] ?? '' }));

const offensesOf = ({ matches }: OffensesParams): ReadonlyArray<string> =>
  listFixtureFiles({ dir: MOCK_SCENE_ROOT }).flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line, index) =>
        matches({ line }) ? [`${relative(MOCK_SCENE_ROOT, file)}:${index + 1} ${line.trim()}`] : [],
      ),
  );

describe('scene fixtures ship in the public demo build', () => {
  it('scans the scene fixtures at all', () => {
    expect(listFixtureFiles({ dir: MOCK_SCENE_ROOT }).length).toBeGreaterThan(50);
  });

  it('writes paths as ~/code/<mock-company>/<repo>, never an absolute home path', () => {
    expect(offensesOf({ matches: hasHomePath })).toEqual([]);
  });

  it('never carries a string shaped like a provider or GitHub token', () => {
    expect(offensesOf({ matches: hasTokenShape })).toEqual([]);
  });

  it('writes email addresses on a mock company or reserved domain', () => {
    expect(offensesOf({ matches: hasRealEmail })).toEqual([]);
  });

  it('flags the shapes it guards against', () => {
    expect(hasHomePath({ line: "worktreePath: '/Users/someone/code/app'" })).toBe(true);
    expect(hasHomePath({ line: "worktreePath: '~/code/harborline/payments-api'" })).toBe(false);
    expect(hasTokenShape({ line: 'Bearer sk-ant-api03-mock' })).toBe(true);
    expect(hasRealEmail({ line: 'someone@gmail.com' })).toBe(true);
    expect(hasRealEmail({ line: 'dana@harborline.dev git@github.com:acme/app' })).toBe(false);
    expect(hasRealEmail({ line: '> ledger-core@2.14.0 test' })).toBe(false);
  });
});
