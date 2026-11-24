import { countNoun } from '../../shared/utils/countNoun';
import { NAMES } from '../../shared/utils/names';
import type { MergeReason, OverlapGroup } from './overlapGroupOf';

export type OverlapWords = Readonly<{
  chip: string;
  title: string;
  lead: string;
  shared: string;
  reasons: ReadonlyArray<string>;
}>;

type Params = {
  readonly group: OverlapGroup;
  readonly sessionLabels: ReadonlyMap<string, string>;
};

const MERGE_REASON_WORDS = {
  'fewest-files': 'fewest files',
  'fewer-files': 'fewer files',
  'started-earlier': 'started earlier',
  'most-files': 'most files',
  'started-later': 'started later',
} as const satisfies Readonly<Record<MergeReason, string>>;

export const overlapWordsOf = ({ group, sessionLabels }: Params): OverlapWords => {
  const others = group.steps.filter((step) => !step.isOwn);
  const [named] = others;
  const label =
    named === undefined || named.mount.sessionId === group.mount.sessionId
      ? (named?.mount.branch ?? '')
      : (sessionLabels.get(named.mount.sessionId) ?? named.mount.branch);
  const chip = `${NAMES.overlaps} ${label}`;
  return {
    chip: others.length > 1 ? `${chip} +${others.length - 1}` : chip,
    title: `${group.steps.length} branches change the same files`,
    lead: 'Merge them in this order to avoid conflicts.',
    shared: countNoun({ count: group.sharedPaths.length, one: 'shared file' }),
    reasons: group.steps.map((step) => MERGE_REASON_WORDS[step.reason]),
  };
};
