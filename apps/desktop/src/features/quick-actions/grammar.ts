import { WORKSPACE_FEATURES } from '../../shared/lib/features';

export type QuickActionGroup =
  'agent' | 'session' | 'workspace' | 'skill' | 'workflow' | 'script' | 'action' | 'help';

export type PrefixMeta = {
  readonly symbol: string;
  readonly noun: string;
  readonly hint: string;
  readonly group: QuickActionGroup;
};

const ALL_PREFIXES: ReadonlyArray<PrefixMeta> = [
  { symbol: '@', noun: 'agents', hint: 'agents in current session', group: 'agent' },
  { symbol: '#', noun: 'sessions', hint: 'sessions', group: 'session' },
  { symbol: ':', noun: 'workspaces', hint: 'workspaces', group: 'workspace' },
  { symbol: '/', noun: 'skills', hint: 'skills', group: 'skill' },
  { symbol: '~', noun: 'workflows', hint: 'workflows', group: 'workflow' },
  { symbol: '$', noun: 'scripts', hint: 'scripts', group: 'script' },
  { symbol: '>', noun: 'actions', hint: 'actions', group: 'action' },
  { symbol: '?', noun: 'help', hint: 'help & shortcuts', group: 'help' },
];

const GROUP_ENABLED: Partial<Record<QuickActionGroup, boolean>> = {
  skill: WORKSPACE_FEATURES.skills,
  workflow: WORKSPACE_FEATURES.workflows,
};

export const PREFIXES: ReadonlyArray<PrefixMeta> = ALL_PREFIXES.filter(
  (prefix) => GROUP_ENABLED[prefix.group] ?? true,
);

export const COMPOSER_PREFIX_GROUPS: ReadonlyArray<QuickActionGroup> = [
  'skill',
  'workflow',
  'agent',
  'script',
];

export const PALETTE_PREFIX_GROUPS: ReadonlyArray<QuickActionGroup> = [
  'agent',
  'session',
  'workspace',
  'script',
  'action',
  'help',
  'workflow',
  'skill',
];

type SurfaceParams = {
  readonly groups: ReadonlyArray<QuickActionGroup>;
};

export const prefixesOf = ({ groups }: SurfaceParams): ReadonlyArray<PrefixMeta> =>
  groups.flatMap((group) => PREFIXES.filter((prefix) => prefix.group === group));

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
