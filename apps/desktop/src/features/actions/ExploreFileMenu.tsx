import { ObjectOverflowMenu } from './components/ObjectOverflowMenu';
import type { ExploreFileActionTarget } from './types';

type Props = {
  readonly target: ExploreFileActionTarget;
  readonly tooltip?: string;
};

export const ExploreFileMenu = ({ target, tooltip }: Props) => (
  <ObjectOverflowMenu
    label={`Actions for ${target.facts.name}`}
    tooltip={tooltip}
    target={target}
    anchorKey={`explore:${target.facts.relPath}`}
  />
);
