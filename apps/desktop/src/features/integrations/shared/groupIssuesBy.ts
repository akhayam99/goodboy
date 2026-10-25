import type { SessionId } from '@goodboy/types';
import { compareIsoDesc } from '../../../shared/utils/compareIsoDesc';

type IssueRow<TIssue> = Readonly<{
  issue: TIssue;
  sessionId: SessionId | null;
}>;

export type IssueGroup<TKey extends string, TIssue> = Readonly<{
  key: TKey;
  label: string;
  rows: ReadonlyArray<IssueRow<TIssue>>;
}>;

type IssueParams<TIssue> = {
  readonly issue: TIssue;
};

type KeyParams<TKey extends string> = {
  readonly key: TKey;
};

type Params<TIssue, TKey extends string> = {
  readonly issues: ReadonlyArray<TIssue>;
  readonly sessionIdByExternalId: ReadonlyMap<string, SessionId>;
  readonly externalIdOf: (params: IssueParams<TIssue>) => string;
  readonly keyOf: (params: IssueParams<TIssue>) => TKey;
  readonly labelOf: (params: KeyParams<TKey>) => string;
  readonly updatedAtOf: (params: IssueParams<TIssue>) => string;
  readonly order: ReadonlyArray<TKey> | null;
};

export const groupIssuesBy = <TIssue, TKey extends string>({
  issues,
  sessionIdByExternalId,
  externalIdOf,
  keyOf,
  labelOf,
  updatedAtOf,
  order,
}: Params<TIssue, TKey>): ReadonlyArray<IssueGroup<TKey, TIssue>> => {
  const buckets = new Map<TKey, Array<IssueRow<TIssue>>>();
  for (const issue of issues) {
    const key = keyOf({ issue });
    const row: IssueRow<TIssue> = {
      issue,
      sessionId: sessionIdByExternalId.get(externalIdOf({ issue })) ?? null,
    };
    const existing = buckets.get(key);
    if (existing !== undefined) {
      existing.push(row);
      continue;
    }
    buckets.set(key, [row]);
  }
  const keys =
    order === null ? [...buckets.keys()].sort((left, right) => left.localeCompare(right)) : order;
  return keys.flatMap((key) => {
    const rows = buckets.get(key);
    if (rows === undefined) {
      return [];
    }
    const sorted = [...rows].sort((left, right) =>
      compareIsoDesc({
        left: updatedAtOf({ issue: left.issue }),
        right: updatedAtOf({ issue: right.issue }),
      }),
    );
    return [{ key, label: labelOf({ key }), rows: sorted }];
  });
};
