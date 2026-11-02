import { WORKSPACE_FEATURES } from '../../shared/lib/features';

export type QuickActionGroup =
  'agent' | 'session' | 'workspace' | 'workflow' | 'script' | 'action' | 'help';

export type PrefixMeta = {
  readonly symbol: string;
  readonly noun: string;
  readonly hint: string;
  readonly group: QuickActionGroup;
  readonly meaning: Readonly<Record<'palette' | 'composer', string | null>>;
};

const ALL_PREFIXES: ReadonlyArray<PrefixMeta> = [
  {
    symbol: '@',
    noun: 'agents',
    hint: 'agents in current session',
    group: 'agent',
    meaning: { palette: 'An agent', composer: 'An agent' },
  },
  {
    symbol: '#',
    noun: 'sessions',
    hint: 'sessions',
    group: 'session',
    meaning: { palette: 'A session', composer: null },
  },
  {
    symbol: ':',
    noun: 'workspaces',
    hint: 'workspaces',
    group: 'workspace',
    meaning: { palette: 'A workspace', composer: null },
  },
  {
    symbol: '~',
    noun: 'workflows',
    hint: 'workflows',
    group: 'workflow',
    meaning: { palette: 'A workflow', composer: 'A workflow' },
  },
  {
    symbol: '$',
    noun: 'scripts',
    hint: 'scripts',
    group: 'script',
    meaning: { palette: 'Scripts', composer: 'Scripts' },
  },
  {
    symbol: '>',
    noun: 'actions',
    hint: 'actions',
    group: 'action',
    meaning: { palette: 'Actions', composer: null },
  },
  {
    symbol: '?',
    noun: 'help',
    hint: 'help & shortcuts',
    group: 'help',
    meaning: { palette: 'Help', composer: null },
  },
];

const GROUP_ENABLED: Partial<Record<QuickActionGroup, boolean>> = {
  workflow: WORKSPACE_FEATURES.workflows,
};

export const PREFIXES: ReadonlyArray<PrefixMeta> = ALL_PREFIXES.filter(
  (prefix) => GROUP_ENABLED[prefix.group] ?? true,
);

export type ParsedQuery = {
  readonly prefix: PrefixMeta | null;
  readonly query: string;
};

export const parseQuery = (raw: string): ParsedQuery => {
  const trimmed = raw.trimStart();
  if (trimmed.length === 0) {
    return { prefix: null, query: '' };
  }
  const ch = trimmed[0]!;
  const meta = PREFIXES.find((p) => p.symbol === ch);
  if (meta) {
    return { prefix: meta, query: trimmed.slice(1).trim() };
  }
  return { prefix: null, query: trimmed };
};
