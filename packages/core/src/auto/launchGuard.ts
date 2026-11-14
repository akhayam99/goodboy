import { isRecord } from '@goodboy/types/helpers';

export const PROTECTED_FILE_PATTERNS = [
  '.github/workflows/**',
  '.gitlab-ci.yml',
  'bitbucket-pipelines.yml',
  '.husky/**',
  '.githooks/**',
  'lefthook.yml',
  'CODEOWNERS',
  '.github/CODEOWNERS',
  '.gitlab/CODEOWNERS',
  'docs/CODEOWNERS',
] as const;

export type PackageManager = Readonly<{
  name: string;
  adds: ReadonlyArray<string>;
  installs: ReadonlyArray<string>;
  manifests: ReadonlyArray<string>;
  lockfiles: ReadonlyArray<string>;
  env: ReadonlyArray<readonly [string, string]>;
}>;

export const PACKAGE_MANAGERS: ReadonlyArray<PackageManager> = [
  {
    name: 'npm',
    adds: ['npm add', 'npm update', 'npm upgrade'],
    installs: ['npm install', 'npm i'],
    manifests: ['package.json'],
    lockfiles: ['package-lock.json', 'npm-shrinkwrap.json'],
    env: [['npm_config_offline', 'true']],
  },
  {
    name: 'pnpm',
    adds: ['pnpm add', 'pnpm update', 'pnpm up', 'pnpm upgrade'],
    installs: ['pnpm install', 'pnpm i'],
    manifests: ['package.json'],
    lockfiles: ['pnpm-lock.yaml'],
    env: [
      ['pnpm_config_offline', 'true'],
      ['pnpm_config_frozen_lockfile', 'true'],
    ],
  },
  {
    name: 'pip',
    adds: ['pip install', 'pip3 install', 'python -m pip install', 'python3 -m pip install'],
    installs: [],
    manifests: ['requirements.txt'],
    lockfiles: [],
    env: [['PIP_NO_INDEX', '1']],
  },
  {
    name: 'uv',
    adds: ['uv add', 'uv pip install'],
    installs: ['uv lock', 'uv sync'],
    manifests: ['pyproject.toml'],
    lockfiles: ['uv.lock'],
    env: [
      ['UV_OFFLINE', '1'],
      ['UV_FROZEN', '1'],
    ],
  },
  {
    name: 'cargo',
    adds: ['cargo add', 'cargo update', 'cargo install'],
    installs: [],
    manifests: ['Cargo.toml'],
    lockfiles: ['Cargo.lock'],
    env: [['CARGO_NET_OFFLINE', 'true']],
  },
  {
    name: 'yarn',
    adds: ['yarn add', 'yarn up', 'yarn upgrade'],
    installs: ['yarn install'],
    manifests: ['package.json'],
    lockfiles: ['yarn.lock'],
    env: [],
  },
  {
    name: 'bun',
    adds: ['bun add', 'bun update'],
    installs: ['bun install', 'bun i'],
    manifests: ['package.json'],
    lockfiles: ['bun.lock', 'bun.lockb'],
    env: [],
  },
  {
    name: 'go',
    adds: ['go get', 'go install'],
    installs: [],
    manifests: ['go.mod'],
    lockfiles: ['go.sum'],
    env: [],
  },
];

export const OFFLINE_PACKAGE_MANAGERS: ReadonlyArray<string> = PACKAGE_MANAGERS.filter(
  (manager) => manager.env.length > 0,
).map((manager) => manager.name);

export const DEPENDENCY_FILES: ReadonlyArray<string> = [
  ...new Set(PACKAGE_MANAGERS.flatMap((manager) => [...manager.manifests, ...manager.lockfiles])),
];

export type LaunchGuardValue = 'ask' | 'allow';

export type LaunchGuard = Readonly<{
  dependencies: LaunchGuardValue;
  protectedFiles: LaunchGuardValue;
  allowedPackages: ReadonlyArray<string>;
  allowedPaths: ReadonlyArray<string>;
}>;

export type LaunchGuardRows = Readonly<{
  dependencies: LaunchGuardValue;
  protectedFiles: LaunchGuardValue;
}>;

export type LaunchAllowance = Readonly<{
  kind: 'dependency' | 'protected_file';
  subject: string;
}>;

type GuardOfParams = {
  readonly rows: LaunchGuardRows;
  readonly allowances: ReadonlyArray<LaunchAllowance>;
};

export const launchGuardOf = ({ rows, allowances }: GuardOfParams): LaunchGuard | null => {
  if (rows.dependencies === 'allow' && rows.protectedFiles === 'allow') {
    return null;
  }
  const allowedPackages = allowances
    .filter((allowance) => allowance.kind === 'dependency')
    .map((allowance) => allowance.subject);
  const allowedPaths = allowances
    .filter((allowance) => allowance.kind === 'protected_file')
    .map((allowance) => allowance.subject);
  return {
    dependencies: allowedPackages.length > 0 ? 'allow' : rows.dependencies,
    protectedFiles: rows.protectedFiles,
    allowedPackages,
    allowedPaths,
  };
};

type ValueParams = {
  readonly value: unknown;
};

const guardValueOf = ({ value }: ValueParams): LaunchGuardValue | null =>
  value === 'ask' || value === 'allow' ? value : null;

const stringsOf = ({ value }: ValueParams): ReadonlyArray<string> | null =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? value : null;

export const parseLaunchGuard = ({ value }: ValueParams): LaunchGuard | null => {
  if (!isRecord(value)) {
    return null;
  }
  const dependencies = guardValueOf({ value: value['dependencies'] });
  const protectedFiles = guardValueOf({ value: value['protectedFiles'] });
  const allowedPackages = stringsOf({ value: value['allowedPackages'] });
  const allowedPaths = stringsOf({ value: value['allowedPaths'] });
  if (
    dependencies === null ||
    protectedFiles === null ||
    allowedPackages === null ||
    allowedPaths === null
  ) {
    return null;
  }
  return { dependencies, protectedFiles, allowedPackages, allowedPaths };
};

type WriteSetParams = {
  readonly writeSet: unknown;
};

export const storedLaunchGuardOf = ({ writeSet }: WriteSetParams): LaunchGuard | null =>
  isRecord(writeSet) ? parseLaunchGuard({ value: writeSet['guard'] }) : null;

type PatternParams = {
  readonly pattern: string;
  readonly path: string;
};

export const isPathInPattern = ({ pattern, path }: PatternParams): boolean => {
  const clean = path.startsWith('./') ? path.slice(2) : path;
  if (pattern.endsWith('/**')) {
    return clean.startsWith(pattern.slice(0, -2));
  }
  return clean === pattern;
};

const SUBJECT_MAX_CHARS = 200;
const QUOTE_CHARS = ['`', '"', "'"] as const;
const VERSION_START = '0123456789^~v<>=';

type TokenParams = {
  readonly token: string;
};

const unquoted = ({ token }: TokenParams): string => {
  let text = token;
  while (text.length > 0 && QUOTE_CHARS.some((quote) => text.startsWith(quote))) {
    text = text.slice(1);
  }
  while (text.length > 0 && QUOTE_CHARS.some((quote) => text.endsWith(quote))) {
    text = text.slice(0, -1);
  }
  return text;
};

type SubjectParams = {
  readonly kind: LaunchAllowance['kind'];
  readonly request: string;
};

export const needSubjectOf = ({ kind, request }: SubjectParams): string | null => {
  const colon = request.indexOf(': ');
  const head = (colon === -1 ? request : request.slice(0, colon)).trim();
  const tokens = head
    .split(' ')
    .map((token) => unquoted({ token: token.trim() }))
    .filter((token) => token !== '');
  const [first, second] = tokens;
  if (first === undefined) {
    return null;
  }
  const isVersioned =
    kind === 'dependency' &&
    second !== undefined &&
    VERSION_START.includes(second.charAt(0)) &&
    !first.slice(1).includes('@');
  const subject = isVersioned ? `${first}@${second}` : first;
  return subject.slice(0, SUBJECT_MAX_CHARS);
};

export type LaunchGuardEnv = Readonly<{ name: string; value: string }>;

export type LaunchGuardRules = Readonly<{
  deniedTools: ReadonlyArray<string>;
  env: ReadonlyArray<LaunchGuardEnv>;
  isNetworkOff: boolean;
}>;

const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit'] as const;

type FileRulesParams = {
  readonly patterns: ReadonlyArray<string>;
};

const fileRulesOf = ({ patterns }: FileRulesParams): ReadonlyArray<string> =>
  patterns.flatMap((pattern) => EDIT_TOOLS.map((tool) => `${tool}(${pattern})`));

const DEPENDENCY_RULES: ReadonlyArray<string> = [
  ...PACKAGE_MANAGERS.flatMap((manager) => [
    ...manager.adds.flatMap((command) => [`Bash(${command}:*)`, `Bash(${command} *)`]),
    ...manager.installs.map((command) => `Bash(${command} *)`),
  ]),
  ...fileRulesOf({ patterns: DEPENDENCY_FILES.map((file) => `**/${file}`) }),
];

const OFFLINE_ENV: ReadonlyArray<LaunchGuardEnv> = PACKAGE_MANAGERS.flatMap((manager) =>
  manager.env.map(([name, value]) => ({ name, value })),
);

type GuardParams = {
  readonly guard: LaunchGuard;
};

export const guardedPatternsOf = ({ guard }: GuardParams): ReadonlyArray<string> =>
  guard.protectedFiles === 'ask'
    ? PROTECTED_FILE_PATTERNS.filter(
        (pattern) => !guard.allowedPaths.some((path) => isPathInPattern({ pattern, path })),
      )
    : [];

export const launchGuardRulesOf = ({ guard }: GuardParams): LaunchGuardRules | null => {
  const isDependencyAsk = guard.dependencies === 'ask';
  const protectedPatterns = guardedPatternsOf({ guard });
  if (!isDependencyAsk && protectedPatterns.length === 0) {
    return null;
  }
  return {
    deniedTools: [
      ...(isDependencyAsk ? DEPENDENCY_RULES : []),
      ...fileRulesOf({ patterns: protectedPatterns }),
    ],
    env: isDependencyAsk ? OFFLINE_ENV : [],
    isNetworkOff: isDependencyAsk,
  };
};
