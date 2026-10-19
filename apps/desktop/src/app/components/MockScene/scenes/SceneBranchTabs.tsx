import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../../store';
import { branchPlace } from '../../../../store/slices/navigation/place';
import { branchScopeOf } from '../../../../store/slices/session-view/branchScopeOf';
import { branchTabsOf, resolveBranchTab } from '../../../../features/branch/branchTabs';
import { entryAriaLabel } from '../../../../features/branch/entryAriaLabel';
import { requestNounLabel } from '../../../../features/branch/requestNounLabel';
import { useBranchIdentity } from '../../../../features/branch/hooks/useBranchIdentity';
import { useBranchTab } from '../../../../features/branch/hooks/useBranchTab';
import { useWorktreeEntryFacts } from '../../../../features/branch/hooks/useWorktreeEntryFacts';
import { WorktreeEntrySlot } from '../../../../features/branch/components/WorktreeEntrySlot';
import { WORKTREE_ENTRY_ICONS } from '../../../../features/branch/worktreeEntryIcons';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { SelectableRow } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';

type Props = {
  readonly sessionId: SessionId;
};

export const SceneBranchTabs = ({ sessionId }: Props) => {
  const identity = useBranchIdentity({ sessionId });
  const storedTab = useBranchTab({ sessionId, mountPath: identity.mountPath });
  const scope = useAppStore(useShallow((state) => branchScopeOf({ state, sessionId })));
  const navigate = useAppStore((state) => state.navigate);
  const facts = useWorktreeEntryFacts({ sessionId });
  const current = resolveBranchTab({ tab: storedTab, scope });
  return (
    <nav aria-label="Worktree" className="flex flex-col px-2">
      <ul aria-label="Branch pages" data-worktree-entries="" className="flex flex-col">
        {branchTabsOf(scope).map((entry) => {
          const Icon = WORKTREE_ENTRY_ICONS[entry.id];
          const fact = facts?.[entry.id] ?? null;
          const label = entry.id === 'pr' ? requestNounLabel({ host: identity.host }) : entry.label;
          return (
            <li key={entry.id}>
              <SelectableRow
                selected={entry.id === current}
                ariaCurrent={entry.id === current ? 'page' : undefined}
                ariaLabel={fact === null ? label : entryAriaLabel({ label, fact })}
                onClick={() =>
                  navigate({
                    to: branchPlace({ sessionId, mountPath: identity.mountPath, tab: entry.id }),
                    mode: 'replace',
                  })
                }
                className="h-7 items-center gap-2 px-2 text-ui"
              >
                <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
                <span data-entry-label="" className="min-w-0 flex-1 truncate">
                  {label}
                </span>
                {fact === null ? null : <WorktreeEntrySlot fact={fact} />}
              </SelectableRow>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
