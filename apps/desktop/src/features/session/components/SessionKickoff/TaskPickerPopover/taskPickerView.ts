import { compareIsoDesc } from '../../../../../shared/utils/compareIsoDesc';
import { draftIssueKey } from '../../../../../store/slices/sessionDraft/draftIssueKey';
import type { IssueCandidate } from '../../../../integrations/fetchIssueCandidates';
import { candidateOfRecord } from '../../../../integrations/starred/candidateOfRecord';
import { INBOX_PROVIDERS, type InboxProvider, type InboxRecord } from '../../../../inbox/types';

export type TaskPickerSource = InboxProvider | 'all';

export type TaskPickerItem = {
  readonly key: string;
  readonly record: InboxRecord;
  readonly candidate: IssueCandidate;
};

export type TaskPickerGroup = {
  readonly provider: InboxProvider;
  readonly items: ReadonlyArray<TaskPickerItem>;
};

export type TaskPickerView = {
  readonly source: TaskPickerSource;
  readonly sources: ReadonlyArray<InboxProvider>;
  readonly counts: Readonly<Partial<Record<TaskPickerSource, number>>>;
  readonly isGrouped: boolean;
  readonly groups: ReadonlyArray<TaskPickerGroup>;
  readonly items: ReadonlyArray<TaskPickerItem>;
};

type Params = {
  readonly records: ReadonlyArray<InboxRecord>;
  readonly connected: ReadonlyArray<InboxProvider>;
  readonly source: TaskPickerSource;
  readonly query: string;
};

type MatchParams = {
  readonly item: TaskPickerItem;
  readonly tokens: ReadonlyArray<string>;
};

const NO_TASK_PROVIDERS: ReadonlySet<InboxProvider> = new Set(['slack', 'bitbucket']);

const TASK_PROVIDERS = INBOX_PROVIDERS.filter((provider) => !NO_TASK_PROVIDERS.has(provider));

type RecordsParams = {
  readonly records: ReadonlyArray<InboxRecord>;
};

const openItemsOf = ({ records }: RecordsParams): ReadonlyArray<TaskPickerItem> => {
  const byKey = new Map<string, TaskPickerItem>();
  for (const record of records) {
    const candidate = record.state === 'done' ? null : candidateOfRecord(record);
    if (candidate !== null) {
      const key = draftIssueKey({ candidate });
      byKey.set(key, { key, record, candidate });
    }
  }
  return [...byKey.values()].sort((left, right) =>
    compareIsoDesc({ left: left.record.updatedAt, right: right.record.updatedAt }),
  );
};

const isMatch = ({ item, tokens }: MatchParams): boolean => {
  const { identifier, title, context, stateLabel } = item.record;
  const haystack = `${identifier} ${title} ${context} ${stateLabel}`.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
};

export const taskPickerView = ({ records, connected, source, query }: Params): TaskPickerView => {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token !== '');
  const all = openItemsOf({ records });
  const matched = tokens.length === 0 ? all : all.filter((item) => isMatch({ item, tokens }));
  const sources = TASK_PROVIDERS.filter(
    (provider) =>
      connected.includes(provider) || all.some((item) => item.record.provider === provider),
  );
  const counts: Partial<Record<TaskPickerSource, number>> = { all: matched.length };
  for (const provider of sources) {
    counts[provider] = matched.filter((item) => item.record.provider === provider).length;
  }
  const shown = source !== 'all' && sources.includes(source) ? source : 'all';
  const groups =
    shown === 'all'
      ? sources
          .map((provider) => ({
            provider,
            items: matched.filter((item) => item.record.provider === provider),
          }))
          .filter((group) => group.items.length > 0)
      : [{ provider: shown, items: matched.filter((item) => item.record.provider === shown) }];
  return {
    source: shown,
    sources,
    counts,
    isGrouped: shown === 'all' && groups.length > 1,
    groups,
    items: groups.flatMap((group) => group.items),
  };
};
