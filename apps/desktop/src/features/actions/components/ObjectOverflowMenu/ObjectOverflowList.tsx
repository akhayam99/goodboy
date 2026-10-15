import { useCallback, useEffect, useMemo } from 'react';
import { MenuList, type MenuEntry } from '@goodboy/ui';
import { useActionEnv } from '../../useActionEnv';
import { useObjectActions } from '../../useObjectActions';
import { toMenuEntries } from '../../toMenuEntries';
import type { ActionMenuBehavior, ActionViewing, ObjectTarget } from '../../types';
import type { OnArm } from '../../../../shared/components/HeaderConfirm/armedAction';

type RunParams = {
  readonly actionId: string;
  readonly choice?: string | null;
};

type Props = ActionMenuBehavior & {
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
  onPreview,
  track,
  isHeld,
}: Props) => {
  const env = useActionEnv({ origin: 'overflow', anchorKey, viewing });
  const { actions, run: runAction } = useObjectActions({ target, env });
  const run = useCallback(
    async (params: RunParams) => {
      if (track === undefined) {
        await runAction(params);
        return;
      }
      await track({ actionId: params.actionId, task: () => runAction(params) });
    },
    [runAction, track],
  );
  useEffect(
    () => () => {
      onPreview?.({ preview: null });
    },
    [onPreview],
  );
  const entries = useMemo((): ReadonlyArray<MenuEntry> => {
    const visible = actions.filter((action) => !omit.includes(action.id));
    const drawn = toMenuEntries({ actions: visible, env, run, onPreview });
    const base =
      isHeld === undefined
        ? drawn
        : drawn.map((entry): MenuEntry =>
            entry.kind === 'item'
              ? { ...entry, isDisabled: isHeld({ actionId: entry.key }) }
              : entry,
          );
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
  }, [actions, env, isHeld, omit, onArm, onPreview, run]);
  return <MenuList label={label} entries={entries} onClose={onClose} />;
};
