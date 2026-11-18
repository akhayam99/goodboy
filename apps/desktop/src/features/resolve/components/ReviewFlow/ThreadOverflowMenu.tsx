import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import type { FixRunActionTarget, ReviewCommentActionTarget } from '../../../actions/types';

type Props = {
  readonly target: ReviewCommentActionTarget | FixRunActionTarget;
  readonly label: string;
  readonly omit?: ReadonlyArray<string>;
  readonly isDisabled?: boolean;
};

export const ThreadOverflowMenu = ({ target, label, omit, isDisabled = false }: Props) => (
  <ObjectOverflowMenu
    target={target}
    label={label}
    disabled={isDisabled}
    {...(omit !== undefined && { omit })}
  />
);
