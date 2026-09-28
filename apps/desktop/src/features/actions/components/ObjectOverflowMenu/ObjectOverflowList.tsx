import { useMemo } from 'react';
import { MenuList } from '@goodboy/ui';
import { useActionEnv } from '../../useActionEnv';
import { useObjectActions } from '../../useObjectActions';
import { toMenuEntries } from '../../toMenuEntries';
import type { ObjectTarget } from '../../types';

type Props = {
  readonly target: ObjectTarget;
  readonly label: string;
  readonly anchorKey: string | null;
  readonly omit: ReadonlyArray<string>;
  readonly onClose: () => void;
};

export const ObjectOverflowList = ({ target, label, anchorKey, omit, onClose }: Props) => {
  const env = useActionEnv({ origin: 'overflow', anchorKey });
  const { actions, run } = useObjectActions({ target, env });
  const entries = useMemo(
    () =>
      toMenuEntries({
        actions: actions.filter((action) => !omit.includes(action.id)),
        env,
        run,
      }),
    [actions, env, omit, run],
  );
  return <MenuList label={label} entries={entries} onClose={onClose} />;
};
