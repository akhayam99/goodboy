import type { AgentRole, ProviderId, StepSize } from '@goodboy/types';
import { AUTO_RESUMING_PROVIDERS, AUTO_WRITER_CHILD_PROVIDERS } from '../../auto/providers';
import { AUTO_WRITER_ROLES } from '../../auto/roles';
import { RUNGS, type Rung } from '../autoRouting/effortLadder';
import { rungForStep } from '../autoRouting/slotRungs';
import { buildCandidates } from './buildCandidates';
import type { CandidateCause } from './candidateCauses';
import { candidateCauseTextOf } from './candidateCauses';
import type { Candidate, CandidateInputs, CandidateScope, ProviderRule } from './types';

export const CANDIDATES_BLOCK_BUDGET = 2400;

const SIZES: ReadonlyArray<StepSize> = ['small', 'medium', 'large'];

const SIZE_WORDS: Readonly<Record<StepSize, string>> = {
  small: 'light',
  medium: 'standard',
  large: 'heavy',
};

const UNAVAILABLE_CAUSES: ReadonlyArray<CandidateCause> = [
  'at-limit',
  'cooldown',
  'breaker',
  'budget',
];

const RULE_LINES: Readonly<Record<ProviderRule, string>> = {
  order:
    'Provider priority: by order. Your provider order wins when several fit; a lighter model further down is fine when it fits the step.',
  load: 'Provider priority: by load. The provider with the most room left wins; the provider order breaks a tie.',
};

type Detail = 'full' | 'no-rate' | 'identity';

type Entry = {
  readonly row: Candidate;
  readonly rungs: ReadonlyArray<Rung>;
};

type ProviderLine = {
  readonly provider: ProviderId;
  readonly row: Candidate;
  readonly entries: ReadonlyArray<Entry>;
};

type Table = {
  readonly lines: ReadonlyArray<ProviderLine>;
  readonly pins: ReadonlyArray<Readonly<{ role: AgentRole; rows: ReadonlyArray<Candidate> }>>;
  readonly unavailable: ReadonlyArray<Readonly<{ provider: ProviderId; cause: CandidateCause }>>;
};

type TableParams = {
  readonly inputs: CandidateInputs;
  readonly roles: ReadonlyArray<AgentRole>;
  readonly scope: CandidateScope;
};

type EntryKeyParams = {
  readonly row: Candidate;
};

const entryKey = ({ row }: EntryKeyParams): string =>
  `${row.provider}|${row.model}|${row.effort ?? ''}`;

type LowestParams = {
  readonly entry: Entry;
};

const lowestRung = ({ entry }: LowestParams): number =>
  Math.min(...entry.rungs.map((rung) => RUNGS.indexOf(rung)));

const tableOf = ({ inputs, roles, scope }: TableParams): Table => {
  const entries = new Map<string, Entry>();
  const struck = new Map<ProviderId, CandidateCause>();
  const pins = new Map<AgentRole, ReadonlyArray<Candidate>>();
  for (const role of roles) {
    for (const size of SIZES) {
      const list = buildCandidates({ inputs, need: { role, size, scope } });
      if (list.isPinned) {
        pins.set(role, pins.get(role) ?? list.rows.filter((row) => row.cause === null));
        continue;
      }
      for (const row of list.rows) {
        if (row.cause !== null) {
          struck.set(row.provider, struck.get(row.provider) ?? row.cause);
          continue;
        }
        const key = entryKey({ row });
        const known = entries.get(key);
        const rungs = known?.rungs ?? [];
        const rung = row.rung;
        entries.set(key, {
          row,
          rungs:
            rung === null || rungs.includes(rung)
              ? rungs
              : [...rungs, rung].sort((left, right) => RUNGS.indexOf(left) - RUNGS.indexOf(right)),
        });
      }
    }
  }
  const byProvider = new Map<ProviderId, Entry[]>();
  for (const entry of entries.values()) {
    byProvider.set(entry.row.provider, [...(byProvider.get(entry.row.provider) ?? []), entry]);
  }
  const lines = [...byProvider.entries()]
    .flatMap(([provider, list]): ProviderLine[] => {
      const [first] = list;
      if (first === undefined) {
        return [];
      }
      const sorted = [...list].sort(
        (left, right) => lowestRung({ entry: left }) - lowestRung({ entry: right }),
      );
      return [{ provider, row: first.row, entries: sorted }];
    })
    .sort((left, right) => left.row.order - right.row.order);
  const unavailable = [...struck.entries()]
    .filter(([provider, cause]) => !byProvider.has(provider) && UNAVAILABLE_CAUSES.includes(cause))
    .map(([provider, cause]) => ({ provider, cause }));
  return {
    lines,
    pins: [...pins.entries()].map(([role, rows]) => ({ role, rows })),
    unavailable,
  };
};

type JoinParams = {
  readonly words: ReadonlyArray<string>;
};

const joinWords = ({ words }: JoinParams): string => {
  if (words.length <= 1) {
    return words.join('');
  }
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1] ?? ''}`;
};

type RowTextParams = {
  readonly entry: Entry;
  readonly detail: Detail;
};

const entryText = ({ entry, detail }: RowTextParams): string => {
  const { row } = entry;
  const effort = row.effort === null ? '' : ` ${row.effort}`;
  const identity = `${entry.rungs.join(',')} ${row.model}${effort}`;
  if (detail !== 'full') {
    return identity;
  }
  const rate =
    row.price === null ? 'no rate' : `$${row.price.inputPerMtok}/$${row.price.outputPerMtok}`;
  return `${identity} ${rate}`;
};

type FactsParams = {
  readonly row: Candidate;
};

const roomText = ({ row }: FactsParams): string => {
  if (row.room === null) {
    return 'no usage reading';
  }
  const used = Math.round(row.room.usedPercent);
  return row.room.isEstimated ? `about ${used}% used, estimated` : `${used}% used`;
};

const loadText = ({ row }: FactsParams): string =>
  `${row.load} ${row.load === 1 ? 'agent' : 'agents'} in the last hour`;

type LineParams = {
  readonly line: ProviderLine;
  readonly detail: Detail;
};

const providerLineText = ({ line, detail }: LineParams): string => {
  const facts =
    detail === 'identity' ? '' : `, ${roomText({ row: line.row })}, ${loadText({ row: line.row })}`;
  const entries = line.entries.map((entry) => entryText({ entry, detail })).join('; ');
  return `${line.row.order}. ${line.provider}${facts}: ${entries}`;
};

type RungLineParams = {
  readonly roles: ReadonlyArray<AgentRole>;
};

const rungLine = ({ roles }: RungLineParams): string => {
  const parts = roles.map(
    (role) => `${role} ${SIZES.map((size) => rungForStep({ slot: role, size })).join('/')}`,
  );
  const sizes = joinWords({ words: SIZES.map((size) => SIZE_WORDS[size]) }).replace(
    ' and ',
    ' or ',
  );
  return `Rung by role for a ${sizes} step: ${parts.join('; ')}.`;
};

type GuardLinesParams = TableParams & {
  readonly table: Table;
  readonly shown: ReadonlyArray<ProviderLine>;
};

const writerLine = ({ roles, scope, shown }: GuardLinesParams): ReadonlyArray<string> => {
  const writers = roles.filter((role) => AUTO_WRITER_ROLES.some((writer) => writer === role));
  const isLimited = shown.some(
    (line) => !AUTO_WRITER_CHILD_PROVIDERS.some((provider) => provider === line.provider),
  );
  if (scope !== 'helper' || writers.length === 0 || !isLimited) {
    return [];
  }
  const allowed = shown
    .map((line) => line.provider)
    .filter((provider) => AUTO_WRITER_CHILD_PROVIDERS.some((writer) => writer === provider));
  if (allowed.length === 0) {
    return [`Agents that write code (${writers.join(', ')}) have no provider right now.`];
  }
  return [
    `Agents that write code (${writers.join(', ')}) run on ${joinWords({ words: allowed })} only.`,
  ];
};

const familyLine = ({ roles }: GuardLinesParams): ReadonlyArray<string> =>
  roles.includes('reviewer')
    ? [
        'A reviewer of a change runs on another model family than the agent that wrote it, unless no other family is left.',
      ]
    : [];

const pinLine = ({ table }: GuardLinesParams): ReadonlyArray<string> => {
  if (table.pins.length === 0) {
    return [];
  }
  const parts = table.pins.map(
    ({ role, rows }) =>
      `${role} ${rows.map((row) => `${row.provider}/${row.model}${row.effort === null ? '' : ` ${row.effort}`}`).join(', ')}`,
  );
  return [`Pinned roles take only these models: ${parts.join('; ')}.`];
};

const unavailableLine = ({ table }: GuardLinesParams): ReadonlyArray<string> => {
  if (table.unavailable.length === 0) {
    return [];
  }
  const parts = table.unavailable.map(
    ({ provider, cause }) => `${provider} (${candidateCauseTextOf({ cause, providerName: null })})`,
  );
  return [`Not available now: ${parts.join(', ')}.`];
};

const resumeLine = ({ scope, shown }: GuardLinesParams): ReadonlyArray<string> => {
  const hasOthers = shown.some(
    (line) => !AUTO_RESUMING_PROVIDERS.some((provider) => provider === line.provider),
  );
  if (scope !== 'helper' || !hasOthers) {
    return [];
  }
  return [
    `Only ${joinWords({ words: AUTO_RESUMING_PROVIDERS })} agents keep their session after a question; on other providers the agent gets its brief again.`,
  ];
};

type MoneyParams = {
  readonly runBudgetLeftUsd: number | null;
};

const budgetLine = ({ runBudgetLeftUsd }: MoneyParams): ReadonlyArray<string> =>
  runBudgetLeftUsd === null ? [] : [`This run has $${runBudgetLeftUsd.toFixed(2)} of budget left.`];

const RATE_LEGEND =
  'Rates are published dollars per million tokens, input/output; no rate means this build has none.';

const ANSWER_LINES: Readonly<Record<CandidateScope, string>> = {
  helper:
    'For each child, copy "provider", "model" and "effort" from one row, at the rung for its role and size or one lighter, and set "modelReason" to the fact that decided it, under 15 words.',
  step: 'For the next step, copy "provider", "model" and "effort" from one row, at the rung for its role and size or one lighter, and set "modelReason" to the fact that decided it, under 15 words.',
};

type RenderParams = TableParams &
  MoneyParams & {
    readonly table: Table;
    readonly detail: Detail;
    readonly shownCount: number;
  };

const render = ({
  inputs,
  roles,
  scope,
  table,
  detail,
  shownCount,
  runBudgetLeftUsd,
}: RenderParams): string => {
  const shown = table.lines.slice(0, shownCount);
  const hidden = table.lines.length - shown.length;
  const guards: GuardLinesParams = { inputs, roles, scope, table, shown };
  return [
    'Models for new agents, by provider in your order:',
    RULE_LINES[inputs.rule],
    rungLine({ roles }),
    ...shown.map((line) => providerLineText({ line, detail })),
    ...(hidden > 0 ? [`${hidden} more ${hidden === 1 ? 'provider' : 'providers'} not shown.`] : []),
    ...writerLine(guards),
    ...familyLine(guards),
    ...pinLine(guards),
    ...unavailableLine(guards),
    ...resumeLine(guards),
    ...budgetLine({ runBudgetLeftUsd }),
    ...(detail === 'full' ? [RATE_LEGEND] : []),
    ANSWER_LINES[scope],
  ].join('\n');
};

type Params = TableParams & {
  readonly runBudgetLeftUsd?: number | null;
  readonly budget?: number;
};

export const formatCandidatesBlock = ({
  inputs,
  roles,
  scope,
  runBudgetLeftUsd = null,
  budget = CANDIDATES_BLOCK_BUDGET,
}: Params): string | null => {
  const table = tableOf({ inputs, roles, scope });
  const providers = new Set([
    ...table.lines.map((line) => line.provider),
    ...table.pins.flatMap((pin) => pin.rows.map((row) => row.provider)),
  ]);
  if (providers.size < 2) {
    return null;
  }
  const base = { inputs, roles, scope, table, runBudgetLeftUsd };
  const details: ReadonlyArray<Detail> = ['full', 'no-rate', 'identity'];
  for (const detail of details) {
    const text = render({ ...base, detail, shownCount: table.lines.length });
    if (text.length <= budget) {
      return text;
    }
  }
  for (let shownCount = table.lines.length - 1; shownCount > 1; shownCount -= 1) {
    const text = render({ ...base, detail: 'identity', shownCount });
    if (text.length <= budget) {
      return text;
    }
  }
  const last = render({ ...base, detail: 'identity', shownCount: 1 });
  return last.length <= budget ? last : null;
};
