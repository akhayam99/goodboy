import { ChevronDown } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import type { PullRequestActionTarget } from '../../../actions/types';

type Props = {
  readonly target: PullRequestActionTarget;
};

export const PrActionsMenu = ({ target }: Props) => (
  <ObjectOverflowMenu
    target={target}
    label="PR actions"
    tooltip="Pull request actions"
    anchorKey={`pull-request:${target.facts.number}`}
    trigger={
      <span className="inline-flex items-center gap-1 text-secondary font-medium">
        PR actions
        <ChevronDown size={ICON_SIZE.row} aria-hidden className="shrink-0 opacity-70" />
      </span>
    }
    triggerClassName="px-1.5"
  />
);
