import {
  DEPENDENCY_FILES,
  PROTECTED_FILE_PATTERNS,
  isPathInPattern,
  type LaunchGuard,
  type LaunchGuardRows,
} from './launchGuard';

export type ChangeRules = Readonly<{
  rows: LaunchGuardRows;
  guard: LaunchGuard | null;
}>;

export type ChangeGateVerdict =
  | Readonly<{ kind: 'clear' }>
  | Readonly<{ kind: 'unread' }>
  | Readonly<{ kind: 'refused'; paths: ReadonlyArray<string> }>;

export type ChangeStage = 'landing' | 'publish';

const LISTED_PATHS = 3;

type RulesParams = {
  readonly rules: ChangeRules;
};

const isDependencyAsked = ({ rules }: RulesParams): boolean =>
  rules.rows.dependencies === 'ask' &&
  (rules.guard === null || rules.guard.allowedPackages.length === 0);

export const isChangeGateOn = ({ rules }: RulesParams): boolean =>
  isDependencyAsked({ rules }) || rules.rows.protectedFiles === 'ask';

type PathParams = {
  readonly path: string;
};

const cleanPathOf = ({ path }: PathParams): string =>
  path.startsWith('./') ? path.slice(2) : path;

const isDependencyFile = ({ path }: PathParams): boolean =>
  DEPENDENCY_FILES.includes(path.slice(path.lastIndexOf('/') + 1));

const isProtectedFile = ({ path }: PathParams): boolean =>
  PROTECTED_FILE_PATTERNS.some((pattern) => isPathInPattern({ pattern, path }));

type AllowedParams = PathParams & {
  readonly guard: LaunchGuard | null;
};

const isPathAllowed = ({ guard, path }: AllowedParams): boolean =>
  guard !== null &&
  guard.allowedPaths.some((allowed) => {
    const clean = cleanPathOf({ path: allowed });
    return clean === path || (clean.endsWith('/') && path.startsWith(clean));
  });

type GateParams = RulesParams & {
  readonly paths: ReadonlyArray<string> | null;
};

export const changeGateOf = ({ rules, paths }: GateParams): ChangeGateVerdict => {
  if (!isChangeGateOn({ rules })) {
    return { kind: 'clear' };
  }
  if (paths === null) {
    return { kind: 'unread' };
  }
  const isDependencyAsk = isDependencyAsked({ rules });
  const isFileAsk = rules.rows.protectedFiles === 'ask';
  const refused = paths
    .map((path) => cleanPathOf({ path }))
    .filter(
      (path) =>
        (isDependencyAsk && isDependencyFile({ path })) ||
        (isFileAsk && isProtectedFile({ path }) && !isPathAllowed({ guard: rules.guard, path })),
    );
  return refused.length === 0 ? { kind: 'clear' } : { kind: 'refused', paths: refused };
};

type MessageParams = {
  readonly verdict: Exclude<ChangeGateVerdict, { kind: 'clear' }>;
  readonly stage: ChangeStage;
};

const STAGE_ENDING: Readonly<Record<ChangeStage, string>> = {
  landing: 'so its checks did not run and nothing landed',
  publish: 'so nothing was pushed',
};

export const changeRefusalOf = ({ verdict, stage }: MessageParams): string => {
  if (verdict.kind === 'unread') {
    return `the changed files could not be read, ${STAGE_ENDING[stage]}`;
  }
  const listed = verdict.paths.slice(0, LISTED_PATHS).join(', ');
  const rest = verdict.paths.length - LISTED_PATHS;
  const names = rest > 0 ? `${listed} and ${rest} more` : listed;
  return `it changed ${names}, which no allowance covers, ${STAGE_ENDING[stage]}`;
};
