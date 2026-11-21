import type { NextScriptRule } from '../types';

export type RuleHit = {
  readonly rule: NextScriptRule;
  readonly paths: ReadonlyArray<string>;
};

type Params = {
  readonly paths: ReadonlyArray<string>;
};

type RuleTest = {
  readonly rule: NextScriptRule;
  readonly pattern: RegExp;
};

const RULES: ReadonlyArray<RuleTest> = [
  {
    rule: 'lockfile',
    pattern:
      /(?:^|\/)(?:pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?|composer\.lock|poetry\.lock|uv\.lock)$/,
  },
  {
    rule: 'schema',
    pattern: /(?:^|\/)(?:schema\.(?:prisma|graphql|sql)|drizzle\.config\.[cm]?[jt]s)$/,
  },
  { rule: 'migrations', pattern: /(?:^|\/)migrations?\/[^/]+$/ },
];

export const nextScriptRulesOf = ({ paths }: Params): ReadonlyArray<RuleHit> =>
  RULES.flatMap(({ rule, pattern }) => {
    const hits = paths.filter((path) => pattern.test(path));
    return hits.length === 0 ? [] : [{ rule, paths: hits }];
  });
