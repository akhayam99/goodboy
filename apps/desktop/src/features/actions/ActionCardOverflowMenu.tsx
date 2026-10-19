import { ObjectOverflowMenu } from './components/ObjectOverflowMenu';
import type { ActionCardActionTarget } from './types';

type Props = {
  readonly target: ActionCardActionTarget;
  readonly label: string;
};

export const ActionCardOverflowMenu = ({ target, label }: Props) => (
  <ObjectOverflowMenu hideWhenEmpty minEntries={1} size="control" target={target} label={label} />
);
