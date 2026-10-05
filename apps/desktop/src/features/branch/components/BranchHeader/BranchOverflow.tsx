import { useMemo } from 'react';
import { AnchoredPopover, MenuList, Tooltip, cn, useDropdown, type MenuEntry } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { runObjectAction } from '../../../actions/registry';
import { toMenuEntries } from '../../../actions/toMenuEntries';
import { useActionEnv } from '../../../actions/useActionEnv';
import type { ActionControls } from '../../../actions/useActionControls';
import { BRANCH_MENU_DIFF, BRANCH_MENU_PULL_REQUEST } from '../../branchPrimary';

type Props = {
  readonly diffControls: ActionControls;
  readonly pullRequestControls: ActionControls;
};

const MENU_LABEL = 'Branch actions';

export const BranchOverflow = ({ diffControls, pullRequestControls }: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    width: 'min-w-[200px] max-w-sm',
    expectedHeight: 320,
    expectedWidth: 240,
  });
  const env = useActionEnv({ origin: 'overflow' });

  const entries = useMemo((): ReadonlyArray<MenuEntry> => {
    const groups = [
      { controls: pullRequestControls, ids: BRANCH_MENU_PULL_REQUEST },
      { controls: diffControls, ids: BRANCH_MENU_DIFF },
    ].map(({ controls, ids }) => {
      const { target } = controls;
      const actions = ids.flatMap((id) => {
        const action = controls.actions.find((candidate) => candidate.id === id);
        return action === undefined ? [] : [action];
      });
      return target === null
        ? []
        : toMenuEntries({
            actions,
            env,
            run: ({ actionId, choice }) => runObjectAction({ target, actionId, env, choice }),
          });
    });
    return groups.flatMap((group, index) =>
      index > 0 && group.length > 0 && groups[index - 1]?.length !== 0
        ? [{ kind: 'separator' as const, key: `separator-${index}` }, ...group]
        : group,
    );
  }, [diffControls, env, pullRequestControls]);

  if (entries.length === 0) {
    return null;
  }

  return (
    <AnchoredPopover
      dropdown={dropdown}
      anchorClassName="shrink-0"
      trigger={
        <Tooltip content={MENU_LABEL} anchorClassName="shrink-0">
          <button
            type="button"
            onClick={dropdown.toggle}
            aria-label={MENU_LABEL}
            aria-haspopup="menu"
            aria-expanded={dropdown.open}
            className={cn(
              'shrink-0 rounded-sm p-1 text-faint-foreground hover:bg-hover hover:text-foreground motion-safe:transition-colors',
              dropdown.open && 'bg-selected text-foreground',
            )}
          >
            <CONCEPT_ICONS.more size={ICON_SIZE.row} aria-hidden />
          </button>
        </Tooltip>
      }
    >
      <MenuList label={MENU_LABEL} entries={entries} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
