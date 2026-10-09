import { GuardedObjectOverflowMenu } from './GuardedObjectOverflowMenu';
import { ObjectOverflowTrigger, type ObjectOverflowMenuProps } from './ObjectOverflowTrigger';

export const ObjectOverflowMenu = (props: ObjectOverflowMenuProps) =>
  props.hideWhenEmpty === true ? (
    <GuardedObjectOverflowMenu {...props} />
  ) : (
    <ObjectOverflowTrigger {...props} />
  );
