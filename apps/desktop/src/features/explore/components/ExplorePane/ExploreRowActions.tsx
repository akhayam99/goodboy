import { ExploreFileMenu } from '../../../actions/ExploreFileMenu';
import { ROW_MENU_TOOLTIP } from '../../../actions/rowMenuTooltip';
import type { ExploreFileActionTarget } from '../../../actions/types';

type Props = {
  readonly target: ExploreFileActionTarget;
  readonly isMenuShown: boolean;
};

export const ExploreRowActions = ({ target, isMenuShown }: Props) => (
  <div data-slot="explore-row-actions" className="flex w-7 shrink-0 items-center justify-end">
    {isMenuShown ? <ExploreFileMenu target={target} tooltip={ROW_MENU_TOOLTIP} /> : null}
  </div>
);
