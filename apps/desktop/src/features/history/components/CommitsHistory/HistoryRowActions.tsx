import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import type { CommitActionTarget } from '../../../actions/types';

type Props = {
  readonly target: CommitActionTarget;
  readonly anchorKey: string;
};

export const HistoryRowActions = ({ target, anchorKey }: Props) => (
  <span className="flex shrink-0 items-center">
    <ObjectOverflowMenu
      target={target}
      anchorKey={anchorKey}
      label={`More for ${target.facts.shortSha}`}
    />
  </span>
);
