import { Ellipsis } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import type { ReviewCommentActionTarget } from '../../../actions/types';

type Props = {
  readonly target: ReviewCommentActionTarget;
  readonly label: string;
  readonly omit: ReadonlyArray<string>;
};

export const ThreadOverflowMenu = ({ target, label, omit }: Props) => (
  <ObjectOverflowMenu
    target={target}
    label={label}
    omit={omit}
    trigger={<Ellipsis size={ICON_SIZE.control} aria-hidden />}
  />
);
