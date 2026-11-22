import { countNoun } from '../../shared/utils/countNoun';
import { NAMES } from '../../shared/utils/names';
import { mergeOrderOf } from './mergeOrderOf';
import type { Overlap } from './overlapsOf';
import type { LiveMount } from './readLiveMounts';

export type OverlapWords = Readonly<{
  chip: string;
  files: string;
  order: string;
}>;

type Params = {
  readonly overlap: Overlap;
  readonly sessionLabels: ReadonlyMap<string, string>;
};

type LabelParams = {
  readonly mount: LiveMount;
};

export const overlapWordsOf = ({ overlap, sessionLabels }: Params): OverlapWords => {
  const isOneSession = overlap.mount.sessionId === overlap.other.sessionId;
  const labelOf = ({ mount }: LabelParams): string =>
    isOneSession ? mount.branch : (sessionLabels.get(mount.sessionId) ?? mount.branch);
  const order = mergeOrderOf({ overlap });
  const [shared] = overlap.paths;
  const rest = overlap.paths.length - 1;
  const first = labelOf({ mount: order.first });
  const then = labelOf({ mount: order.then });
  return {
    chip: `${NAMES.overlaps} ${labelOf({ mount: overlap.other })}`,
    files:
      rest === 0
        ? `Both branches change ${shared ?? ''}.`
        : `Both branches change ${shared ?? ''} and ${countNoun({ count: rest, one: 'more file' })}.`,
    order:
      order.reason === 'fewer-files'
        ? `Merge ${first} first: it changes ${countNoun({ count: order.firstFiles, one: 'file' })}, ${then} changes ${order.thenFiles}.`
        : `Merge ${first} first: same size, and it started earlier.`,
  };
};
