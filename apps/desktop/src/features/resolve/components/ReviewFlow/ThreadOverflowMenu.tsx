import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import type { ReviewCommentActionTarget } from '../../../actions/types';

type Props = {
  readonly target: ReviewCommentActionTarget;
  readonly label: string;
  readonly omit: ReadonlyArray<string>;
};

export const ThreadOverflowMenu = ({ target, label, omit }: Props) => (
  <ObjectOverflowMenu target={target} label={label} omit={omit} />
);
