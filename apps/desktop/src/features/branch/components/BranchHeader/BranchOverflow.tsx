import { useMemo } from 'react';
import {
  AnchoredPopover,
  MenuList,
  MenuTriggerButton,
  useDropdown,
  type MenuEntry,
} from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { runObjectAction } from '../../../actions/registry';
import { toMenuEntries } from '../../../actions/toMenuEntries';
import { useActionEnv } from '../../../actions/useActionEnv';
import type { ActionControls } from '../../../actions/useActionControls';
import { BRANCH_MENU_DIFF, BRANCH_MENU_PULL_REQUEST } from '../../branchPrimary';

type Props = {
  readonly diffControls: ActionControls;
  readonly pullRequestControls: ActionControls;
  readonly shownIds: ReadonlyArray<string>;
};

const MENU_LABEL = 'Branch actions';
const PUSH_ID = 'diff.push';
const HEADER_RUN: ReadonlySet<string> = new Set([
  PUSH_ID,
  'pullRequest.merge',
  'pullRequest.markReady',
  'pullRequest.reopen',
]);
const MIN_DRAWN_ENTRIES = 2;

export const BranchOverflow = ({ diffControls, pullRequestControls, shownIds }: Props) => {
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
        if (action === undefined || shownIds.includes(id)) {
          return [];
        }
        if (id === PUSH_ID && action.slot !== 'menu') {
          return [];
        }
        return HEADER_RUN.has(id) ? [{ ...action, confirm: null }] : [action];
      });
      return target === null
        ? []
        : toMenuEntries({
            actions,
            env,
            run: async ({ actionId, choice }) => {
              if (HEADER_RUN.has(actionId)) {
                controls.trigger({ actionId });
                return;
              }
              await runObjectAction({ target, actionId, env, choice });
            },
          });
    });
    return groups.flatMap((group, index) =>
      index > 0 && group.length > 0 && groups[index - 1]?.length !== 0
        ? [{ kind: 'separator' as const, key: `separator-${index}` }, ...group]
        : group,
    );
  }, [diffControls, env, pullRequestControls, shownIds]);

  if (entries.filter((entry) => entry.kind === 'item').length < MIN_DRAWN_ENTRIES) {
    return null;
  }

  return (
    <AnchoredPopover
      dropdown={dropdown}
      anchorClassName="shrink-0"
      trigger={
        <MenuTriggerButton
          label={MENU_LABEL}
          isOpen={dropdown.open}
          size="control"
          onClick={dropdown.toggle}
        >
          <CONCEPT_ICONS.more size={ICON_SIZE.row} aria-hidden />
        </MenuTriggerButton>
      }
    >
      <MenuList label={MENU_LABEL} entries={entries} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
