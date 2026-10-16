import { ChevronLeft, type LucideIcon } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { StatusDot } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { branchPlace } from '../../../store/slices/navigation/place';
import type { BranchTab } from '../../../store/slices/navigation/types';
import { branchScopeOf } from '../../../store/slices/session-view/branchScopeOf';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../shared/components/conceptIcons';
import { branchTabsOf, resolveBranchTab } from '../../../features/branch/branchTabs';
import { useBranchIdentity } from '../../../features/branch/hooks/useBranchIdentity';
import { useBranchTab } from '../../../features/branch/hooks/useBranchTab';
import { useWorktreeEntryFacts } from '../../../features/branch/hooks/useWorktreeEntryFacts';
import { openLens } from '../../../features/session/openLens';
import { sessionTitle } from '../../../features/session/sessionTitle';
import { RailButton } from '../SideColumn/RailButton';

type Props = {
  readonly session: Session;
};

const ENTRY_ICON: Readonly<Record<BranchTab, LucideIcon>> = {
  pr: CONCEPT_ICONS.pr,
  comments: CONCEPT_ICONS.comments,
  files: CONCEPT_ICONS.diff,
  commits: CONCEPT_ICONS.commits,
  checks: CONCEPT_ICONS.checks,
};

export const RailWorktreeLevel = ({ session }: Props) => {
  const sessionId = session.id;
  const identity = useBranchIdentity({ sessionId });
  const storedTab = useBranchTab({ sessionId, mountPath: identity.mountPath });
  const scope = useAppStore(useShallow((state) => branchScopeOf({ state, sessionId })));
  const navigate = useAppStore((state) => state.navigate);
  const tab = resolveBranchTab({ tab: storedTab, scope });
  const facts = useWorktreeEntryFacts({ sessionId });

  return (
    <div data-rail-level="worktree" className="flex flex-col px-2">
      <RailButton
        id="level-back"
        icon={ChevronLeft}
        iconSize={ICON_SIZE.row}
        label={`Back to session ${sessionTitle({ session })}`}
        shortcut="nav.back"
        isCurrent={false}
        isPage
        onSelect={() => openLens({ sessionId, lens: null })}
      />
      {branchTabsOf(scope).map((entry) => {
        const fact = facts?.[entry.id] ?? null;
        const word = fact === null ? null : (fact.tooltip ?? fact.text);
        return (
          <RailButton
            key={entry.id}
            id={`worktree-${entry.id}`}
            icon={ENTRY_ICON[entry.id]}
            iconSize={ICON_SIZE.row}
            label={word === null ? entry.label : `${entry.label}, ${word}`}
            {...(entry.shortcut !== null && { shortcut: entry.shortcut })}
            isCurrent={tab === entry.id}
            isPage
            {...(fact !== null &&
              fact.tone !== null && {
                badge: (
                  <span aria-hidden className="absolute right-0.5 top-0.5 flex">
                    <StatusDot tone={fact.tone} size="sm" />
                  </span>
                ),
              })}
            onSelect={() =>
              navigate({
                to: branchPlace({ sessionId, mountPath: identity.mountPath, tab: entry.id }),
                mode: 'replace',
              })
            }
          />
        );
      })}
    </div>
  );
};
