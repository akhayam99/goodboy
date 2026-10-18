import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import type { CommitActionTarget } from '../../../actions/types';

type Props = {
  readonly target: CommitActionTarget;
  readonly anchorKey: string;
};

export const HistoryRowActions = ({ target, anchorKey }: Props) => (
  <span data-slot="commit-row-actions" className="row-actions flex w-7 shrink-0 items-center">
    <ObjectOverflowMenu
      target={target}
      anchorKey={anchorKey}
      label={`More for ${target.facts.shortSha}`}
    />
  </span>
);
