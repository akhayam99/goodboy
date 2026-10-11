import { useActionEnv } from '../../useActionEnv';
import { useObjectActions } from '../../useObjectActions';
import { toMenuEntries } from '../../toMenuEntries';
import { ObjectOverflowTrigger, type ObjectOverflowMenuProps } from './ObjectOverflowTrigger';

const NO_OMISSIONS: ReadonlyArray<string> = [];
const MIN_DRAWN_ENTRIES = 2;

export const GuardedObjectOverflowMenu = (props: ObjectOverflowMenuProps) => {
  const { target, anchorKey = null, viewing = null, omit = NO_OMISSIONS } = props;
  const env = useActionEnv({ origin: 'overflow', anchorKey, viewing });
  const { actions, run } = useObjectActions({ target, env });
  const visible = actions.filter((action) => !omit.includes(action.id));
  const drawn = toMenuEntries({ actions: visible, env, run }).filter(
    (entry) => entry.kind === 'item',
  );

  if (drawn.length < MIN_DRAWN_ENTRIES) {
    return null;
  }

  return <ObjectOverflowTrigger {...props} />;
};
