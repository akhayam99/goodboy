import { parseQuery } from '../quick-actions/grammar';
import { ACTION_GROUPS, type ActionGroup } from '../actions/types';
import { recentKeys, type FrecencyState } from './frecency';
import { rankSessionVerbs, type PaletteTier } from './paletteTiers';
import { rankCandidates } from './rank';
import type { PaletteEntry, PaletteKind } from './types';

export type CommandRow = {
  readonly item: PaletteEntry;
  readonly positions: ReadonlyArray<number>;
};

export type CommandSection = {
  readonly title: string | null;
  readonly rows: ReadonlyArray<CommandRow>;
};

type Params = {
  readonly query: string;
  readonly entries: ReadonlyArray<PaletteEntry>;
  readonly scopeVerbs: ReadonlyArray<PaletteEntry>;
  readonly scopeTitle: string | null;
  readonly scopeKey: string | null;
  readonly parentVerbs: ReadonlyArray<PaletteEntry>;
  readonly parentTitle: string | null;
  readonly frecency: FrecencyState;
  readonly now: number;
  readonly ask?: PaletteEntry | null;
  readonly tier?: PaletteTier | null;
  readonly isScopeSession?: boolean;
  readonly allActions?: PaletteEntry | null;
  readonly next?: ReadonlyArray<PaletteEntry>;
  readonly runs?: ReadonlyArray<PaletteEntry>;
  readonly needsYou?: ReadonlyArray<PaletteEntry>;
  readonly extra?: ReadonlyArray<PaletteEntry>;
};

type ActionsParams = {
  readonly query: string;
  readonly verbs: ReadonlyArray<PaletteEntry>;
  readonly frecency: FrecencyState;
  readonly now: number;
};

const RECENT_LIMIT = 5;

const JUMP_TO_TITLE = 'Jump to';

const QUESTION_WORDS = 4;

type DefaultKeyParams = {
  readonly query: string;
  readonly rows: ReadonlyArray<CommandRow>;
  readonly askKey: string;
};

export const defaultCommandKey = ({ query, rows, askKey }: DefaultKeyParams): string | null => {
  const first = rows[0]?.item.key ?? null;
  const next = rows[1]?.item.key ?? null;
  if (first !== askKey || next === null) {
    return first;
  }
  const text = query.trim();
  const isQuestion = text.endsWith('?') || text.split(/\s+/).length >= QUESTION_WORDS;
  return isQuestion ? first : next;
};

const RESULT_LIMIT = 50;

const RECENT_KINDS: ReadonlySet<PaletteKind> = new Set<PaletteKind>([
  'session',
  'agent',
  'artifact',
  'workspace',
]);

const EMPTY_SECTION_KINDS: ReadonlyArray<readonly [string, ReadonlySet<PaletteKind>]> = [
  ['Go to', new Set<PaletteKind>(['goto'])],
  ['App', new Set<PaletteKind>(['action'])],
  ['Help', new Set<PaletteKind>(['help'])],
];

const NEXT_TITLE = 'Next';

const RUNS_TITLE = 'Runs';

const NEEDS_YOU_TITLE = 'Needs you';

const GROUP_TITLES: Readonly<Record<ActionGroup, string>> = {
  open: 'Open',
  act: 'Act',
  copy: 'Copy and export',
  danger: 'Danger',
};

const plain = (item: PaletteEntry): CommandRow => ({ item, positions: [] });

const isRunnable = (entry: PaletteEntry): boolean => entry.isBlocked !== true;

const isScopeOpen = (entry: PaletteEntry): boolean =>
  entry.action !== undefined && entry.action.group === 'open' && entry.action.id.endsWith('.open');

export const buildCommandList = ({
  query,
  entries,
  scopeVerbs,
  scopeTitle,
  scopeKey,
  parentVerbs,
  parentTitle,
  frecency,
  now,
  ask = null,
  tier = null,
  isScopeSession = false,
  allActions = null,
  next = [],
  runs = [],
  needsYou = [],
  extra = [],
}: Params): ReadonlyArray<CommandSection> => {
  const parsed = parseQuery(query);
  const pool = [...scopeVerbs, ...parentVerbs, ...extra, ...entries];
  if (parsed.prefix !== null) {
    const group = parsed.prefix.group;
    const inGroup = pool.filter((entry) => entry.group === group);
    const rows = rankCandidates({
      items: inGroup,
      query: parsed.query,
      frecency,
      now,
      limit: RESULT_LIMIT,
    });
    return [{ title: null, rows }];
  }
  if (parsed.query.length > 0) {
    const rows = rankCandidates({
      items: pool,
      query: parsed.query,
      frecency,
      now,
      limit: RESULT_LIMIT,
    });
    if (ask === null) {
      return [{ title: null, rows }];
    }
    return [
      { title: null, rows: [plain(ask)] },
      ...(rows.length === 0 ? [] : [{ title: JUMP_TO_TITLE, rows }]),
    ];
  }
  const tiered = ({
    list,
    isRanked,
  }: {
    readonly list: ReadonlyArray<PaletteEntry>;
    readonly isRanked: boolean;
  }): ReadonlyArray<PaletteEntry> =>
    isRanked && tier !== null
      ? [...rankSessionVerbs({ tier, verbs: list }), ...(allActions === null ? [] : [allActions])]
      : list.filter((entry) => isRunnable(entry) && !isScopeOpen(entry));
  const verbs = tiered({ list: scopeVerbs, isRanked: isScopeSession });
  const parents = tiered({ list: parentVerbs, isRanked: parentVerbs.length > 0 });
  const byKey = new Map(entries.map((entry) => [entry.key, entry] as const));
  const recentEntries = recentKeys({ state: frecency, now, limit: RECENT_LIMIT * 4 })
    .filter((key) => key !== scopeKey)
    .flatMap((key) => {
      const entry = byKey.get(key);
      return entry !== undefined && RECENT_KINDS.has(entry.kind) ? [entry] : [];
    });
  const recents = [
    ...recentEntries.filter((entry) => entry.kind === 'agent'),
    ...recentEntries.filter((entry) => entry.kind !== 'agent'),
  ].slice(0, RECENT_LIMIT);
  const sections: Array<CommandSection> = [
    { title: NEEDS_YOU_TITLE, rows: needsYou.map(plain) },
    { title: NEXT_TITLE, rows: next.map(plain) },
    { title: scopeTitle, rows: verbs.map(plain) },
    { title: parentTitle, rows: parents.map(plain) },
    { title: RUNS_TITLE, rows: runs.map(plain) },
    { title: 'Recent', rows: recents.map(plain) },
    ...EMPTY_SECTION_KINDS.map(([title, kinds]) => ({
      title,
      rows: entries.filter((entry) => kinds.has(entry.kind)).map(plain),
    })),
  ];
  return sections.filter((section) => section.rows.length > 0);
};

export const buildActionList = ({
  query,
  verbs,
  frecency,
  now,
}: ActionsParams): ReadonlyArray<CommandSection> => {
  if (query.trim().length > 0) {
    return [{ title: null, rows: rankCandidates({ items: verbs, query, frecency, now }) }];
  }
  return ACTION_GROUPS.map((group) => ({
    title: GROUP_TITLES[group],
    rows: verbs.filter((entry) => entry.action?.group === group && isRunnable(entry)).map(plain),
  })).filter((section) => section.rows.length > 0);
};

type ChoicesParams = {
  readonly query: string;
  readonly title: string;
  readonly choices: ReadonlyArray<PaletteEntry>;
  readonly frecency: FrecencyState;
  readonly now: number;
};

export const buildChoiceList = ({
  query,
  title,
  choices,
  frecency,
  now,
}: ChoicesParams): ReadonlyArray<CommandSection> =>
  query.trim().length > 0
    ? [{ title: null, rows: rankCandidates({ items: choices, query, frecency, now }) }]
    : [{ title, rows: choices.map(plain) }];

export const flattenRows = (sections: ReadonlyArray<CommandSection>): ReadonlyArray<CommandRow> =>
  sections.flatMap((section) => section.rows);
