import { ExploreFileMenu } from '../../../actions/ExploreFileMenu';
import type { ExploreFileActionTarget } from '../../../actions/types';

type Props = {
  readonly target: ExploreFileActionTarget;
  readonly isMenuShown: boolean;
};

export const ExploreRowActions = ({ target, isMenuShown }: Props) => (
  <div data-slot="explore-row-actions" className="flex w-7 shrink-0 items-center justify-end">
    {isMenuShown ? <ExploreFileMenu target={target} /> : null}
  </div>
);
