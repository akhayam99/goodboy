import { useMemo } from 'react';
import { MenuList, type MenuEntry } from '@goodboy/ui';
import { useActionEnv } from '../../useActionEnv';
import { useObjectActions } from '../../useObjectActions';
import { toMenuEntries } from '../../toMenuEntries';
import type { ActionViewing, ObjectTarget } from '../../types';
import type { OnArm } from '../../../../shared/components/HeaderConfirm/armedAction';

type Props = {
  readonly target: ObjectTarget;
  readonly label: string;
  readonly anchorKey: string | null;
  readonly omit: ReadonlyArray<string>;
  readonly onClose: () => void;
  readonly viewing?: ActionViewing | null;
  readonly onArm?: OnArm | undefined;
};

export const ObjectOverflowList = ({
  target,
  label,
  anchorKey,
  omit,
  onClose,
  viewing = null,
  onArm,
}: Props) => {
  const env = useActionEnv({ origin: 'overflow', anchorKey, viewing });
  const { actions, run } = useObjectActions({ target, env });
  const entries = useMemo((): ReadonlyArray<MenuEntry> => {
    const visible = actions.filter((action) => !omit.includes(action.id));
    const base = toMenuEntries({ actions: visible, env, run });
    if (onArm === undefined) {
      return base;
    }
    return base.map((entry): MenuEntry => {
      if (entry.kind !== 'item' || entry.confirm == null) {
        return entry;
      }
      const action = visible.find((candidate) => candidate.id === entry.key);
      if (action === undefined) {
        return entry;
      }
      return {
        ...entry,
        confirm: null,
        onSelect: () => onArm({ action, run: () => run({ actionId: action.id }) }),
      };
    });
  }, [actions, env, omit, onArm, run]);
  return <MenuList label={label} entries={entries} onClose={onClose} />;
};
