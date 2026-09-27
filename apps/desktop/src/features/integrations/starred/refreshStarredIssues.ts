import type { IsoDateTime, StarredIssue } from '@goodboy/types';
import type { InboxRecord } from '../../inbox/types';
import { lookupIssueByCode, type LookupDeps } from '../issueCode/lookupIssueByCode';
import type { LookupTarget } from '../issueCode/routeIssueCode';
import { lookupTargetOf, starKey } from './starredIssueOf';

export type StarredRefresh = {
  readonly snapshots: ReadonlyArray<StarredIssue>;
  readonly records: Readonly<Record<string, InboxRecord>>;
};

const sameTarget = (left: LookupTarget, right: LookupTarget): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

type Params = LookupDeps & {
  readonly issues: ReadonlyArray<StarredIssue>;
  readonly now: IsoDateTime;
};

export const refreshStarredIssues = async ({
  issues,
  now,
  ...deps
}: Params): Promise<StarredRefresh> => {
  const paired = issues.flatMap((issue) => {
    const target = lookupTargetOf(issue);
    return target === null ? [] : [{ issue, target }];
  });
  const result = await lookupIssueByCode({ ...deps, targets: paired.map((pair) => pair.target) });
  const snapshots: StarredIssue[] = [];
  const records: Record<string, InboxRecord> = {};
  for (const { issue, target } of paired) {
    const hit = result.hits.find((candidate) => sameTarget(candidate.target, target));
    if (hit !== undefined) {
      records[starKey(issue)] = hit.record;
      snapshots.push({
        ...issue,
        identifier: hit.record.identifier,
        title: hit.record.title,
        url: hit.record.url,
        state: hit.record.state,
        stateLabel: hit.record.stateLabel,
        refreshedAt: now,
      });
      continue;
    }
    const miss = result.misses.find((candidate) => sameTarget(candidate.target, target));
    if (miss?.failure === 'not-found') {
      snapshots.push({ ...issue, state: 'missing', refreshedAt: now });
    }
  }
  return { snapshots, records };
};
