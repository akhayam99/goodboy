import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import { ROW_MENU_TOOLTIP } from '../../../actions/rowMenuTooltip';
import type { CommitActionTarget } from '../../../actions/types';
import { HISTORY_ROW_CUTS } from './historyRowCuts';

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
      tooltip={ROW_MENU_TOOLTIP}
      cuts={HISTORY_ROW_CUTS}
    />
  </span>
);
