import { ObjectOverflowMenu } from './components/ObjectOverflowMenu';
import type { IntegrationActionTarget } from './types';

type Props = {
  readonly target: IntegrationActionTarget;
};

export const IntegrationMenu = ({ target }: Props) => (
  <ObjectOverflowMenu label={`More ${target.facts.label} actions`} target={target} hideWhenEmpty />
);
