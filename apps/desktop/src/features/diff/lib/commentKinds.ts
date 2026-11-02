import { countNoun } from '../../../shared/utils/countNoun';
export type CommentKinds = {
  readonly notes: number;
  readonly host: number;
  readonly hostLabel: string | null;
};

export const NO_KINDS: CommentKinds = { notes: 0, host: 0, hostLabel: null };

type LabelParams = {
  readonly kinds: CommentKinds;
};

export const kindsLabelOf = ({ kinds }: LabelParams): string => {
  const parts: Array<string> = [];
  if (kinds.notes > 0) {
    parts.push(`${countNoun({ count: kinds.notes, one: 'draft' })}`);
  }
  if (kinds.host > 0) {
    parts.push(`${kinds.host} on ${kinds.hostLabel ?? 'the host'}`);
  }
  return parts.join(', ');
};
