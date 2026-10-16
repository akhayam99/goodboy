import { ObjectOverflowMenu } from './components/ObjectOverflowMenu';
import type { ExploreFileActionTarget } from './types';

type Props = {
  readonly target: ExploreFileActionTarget;
};

export const ExploreFileMenu = ({ target }: Props) => (
  <ObjectOverflowMenu
    label={`Actions for ${target.facts.name}`}
    target={target}
    anchorKey={`explore:${target.facts.relPath}`}
  />
);
