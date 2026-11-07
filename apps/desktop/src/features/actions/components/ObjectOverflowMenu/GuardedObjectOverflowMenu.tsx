import { useActionEnv } from '../../useActionEnv';
import { useObjectActions } from '../../useObjectActions';
import { toMenuEntries } from '../../toMenuEntries';
import { ObjectOverflowTrigger, type ObjectOverflowMenuProps } from './ObjectOverflowTrigger';
import { visibleActionsOf } from './visibleActionsOf';

const NO_OMISSIONS: ReadonlyArray<string> = [];
const DEFAULT_MIN_DRAWN_ENTRIES = 2;

export const GuardedObjectOverflowMenu = (props: ObjectOverflowMenuProps) => {
  const {
    target,
    anchorKey = null,
    viewing = null,
    omit = NO_OMISSIONS,
    only = null,
    cuts,
    minEntries = DEFAULT_MIN_DRAWN_ENTRIES,
  } = props;
  const env = useActionEnv({ origin: 'overflow', anchorKey, viewing });
  const { actions, run } = useObjectActions({ target, env });
  const visible = visibleActionsOf({ actions, omit, only, relabel: null, cuts });
  const drawn = toMenuEntries({ actions: visible, env, run }).filter(
    (entry) => entry.kind === 'item',
  );

  if (drawn.length < minEntries) {
    return null;
  }

  return <ObjectOverflowTrigger {...props} />;
};
