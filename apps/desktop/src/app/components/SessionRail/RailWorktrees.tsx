import { useMemo } from 'react';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { useBranchIdentity } from '../../../features/branch/hooks/useBranchIdentity';
import { useMountRows } from '../../../features/session/components/SessionOverviewPane/ProjectMountRows/useMountRows';
import { useWorktreeStatusSnapshot } from '../../../features/session/hooks/useWorktreeStatuses';
import { worktreeStatusTargetsOf } from '../../../features/session/hooks/useWorktreeStatuses/targets';
import { RailFlyout } from '../SideColumn/RailFlyout';
import { focusFirstFlyoutRow } from '../SideColumn/focusFirstFlyoutRow';
import { isKeyboardFocus } from '../SideColumn/isKeyboardFocus';
import { useRailFlyout } from '../SideColumn/useRailFlyout';
import { BRANCH_LENSES } from './branchLenses';
import { RailBranchRow } from './RailBranchRow';
import { RailBranchesButton } from './RailBranchesButton';
import { RailWorktreeButton } from './RailWorktreeButton';
import { railBranchesSplitOf } from './railBranchesSplitOf';
import { useRailBranchEntries } from './useRailBranchEntries';

type Props = {
  readonly session: Session;
};

export const RailWorktrees = ({ session }: Props) => {
  const sessionId = session.id;
  const groups = useMountRows({ sessionId });
  const projects = useAppStore((state) => state.projects);
  const branch = useBranchIdentity({ sessionId });
  const isBranchShown = useAppStore((s) => BRANCH_LENSES.has(s.activeLens[sessionId] ?? null));
  const shownPath = isBranchShown ? branch.mountPath : null;
  const flyout = useRailFlyout();
  const rows = useMemo(
    () => groups.flatMap((group) => [...group.rows, ...group.finishedRows]),
    [groups],
  );
  const targets = useMemo(
    () => worktreeStatusTargetsOf({ mounts: rows, projects }),
    [rows, projects],
  );
  const snapshot = useWorktreeStatusSnapshot({ targets });
  const entries = useRailBranchEntries({
    sessionId,
    rows,
    statuses: snapshot.statuses,
    shownPath,
  });
  const { own, folded } = useMemo(() => railBranchesSplitOf({ entries }), [entries]);
  if (rows.length === 0) {
    return null;
  }

  return (
    <div data-rail-worktrees="" className="flex flex-col">
      {own.map((entry) => (
        <RailWorktreeButton key={entry.row.mountId} sessionId={sessionId} entry={entry} />
      ))}
      {folded.length === 0 ? null : (
        <>
          <RailBranchesButton
            count={folded.length}
            onEnter={(event) =>
              flyout.enter({
                key: 'branches',
                anchor: event.currentTarget,
                isImmediate:
                  event.type === 'click' ||
                  (event.type === 'focus' && isKeyboardFocus({ element: event.currentTarget })),
              })
            }
            onLeave={flyout.leave}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowDown') {
                return;
              }
              event.preventDefault();
              if (flyout.target?.key === 'branches') {
                focusFirstFlyoutRow();
                return;
              }
              flyout.enter({ key: 'branches', anchor: event.currentTarget, isImmediate: true });
              window.requestAnimationFrame(focusFirstFlyoutRow);
            }}
          />
          <RailFlyout
            target={flyout.target}
            label="Branches"
            onKeep={flyout.keep}
            onLeave={flyout.leave}
            onClose={flyout.close}
            onDismiss={flyout.dismiss}
          >
            {entries.map((entry) => (
              <RailBranchRow key={entry.row.mountId} sessionId={sessionId} entry={entry} />
            ))}
          </RailFlyout>
        </>
      )}
    </div>
  );
};
