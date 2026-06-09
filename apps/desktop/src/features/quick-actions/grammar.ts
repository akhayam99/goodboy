/**
 * Prefix grammar shared by the command palette (⌘K) and the in-chat
 * quick-actions popover, single source so the two never drift.
 */

export type QuickActionGroup =
  | 'agent'
  | 'session'
  | 'workspace'
  | 'skill'
  | 'workflow'
  | 'script'
  | 'action'
  | 'help';

export type PrefixMeta = {
  readonly symbol: string;
  readonly hint: string;
  readonly group: QuickActionGroup;
};

export const PREFIXES: ReadonlyArray<PrefixMeta> = [
  { symbol: '@', hint: 'agents in current session', group: 'agent' },
  { symbol: '#', hint: 'sessions', group: 'session' },
  { symbol: ':', hint: 'workspaces', group: 'workspace' },
  { symbol: '/', hint: 'skills', group: 'skill' },
  { symbol: '~', hint: 'workflows', group: 'workflow' },
  { symbol: '$', hint: 'scripts', group: 'script' },
  { symbol: '>', hint: 'actions', group: 'action' },
  { symbol: '?', hint: 'help & shortcuts', group: 'help' },
];

export type ParsedQuery = {
  readonly prefix: PrefixMeta | null;
  readonly query: string;
};

export function parseQuery(raw: string): ParsedQuery {
  const trimmed = raw.trimStart();
  if (trimmed.length === 0) return { prefix: null, query: '' };
  const ch = trimmed[0]!;
  const meta = PREFIXES.find((p) => p.symbol === ch);
  if (meta) return { prefix: meta, query: trimmed.slice(1).trim() };
  return { prefix: null, query: trimmed };
}
