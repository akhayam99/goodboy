import { ObjectOverflowMenu } from './components/ObjectOverflowMenu';
import type { ProviderActionTarget } from './types';

type Props = {
  readonly target: ProviderActionTarget;
};

export const ProviderMenu = ({ target }: Props) => (
  <ObjectOverflowMenu label={`More ${target.facts.label} actions`} target={target} />
);
