import { useActionEnv } from '../../useActionEnv';
import { useObjectActions } from '../../useObjectActions';
import { ObjectOverflowTrigger, type ObjectOverflowMenuProps } from './ObjectOverflowTrigger';

const NO_OMISSIONS: ReadonlyArray<string> = [];

export const GuardedObjectOverflowMenu = (props: ObjectOverflowMenuProps) => {
  const { target, anchorKey = null, viewing = null, omit = NO_OMISSIONS } = props;
  const env = useActionEnv({ origin: 'overflow', anchorKey, viewing });
  const { actions } = useObjectActions({ target, env });

  if (actions.every((action) => omit.includes(action.id))) {
    return null;
  }

  return <ObjectOverflowTrigger {...props} />;
};
