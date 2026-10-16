import { ChevronLeft, type LucideIcon } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { branchPlace } from '../../../store/slices/navigation/place';
import type { BranchTab } from '../../../store/slices/navigation/types';
import { branchScopeOf } from '../../../store/slices/session-view/branchScopeOf';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { branchTabsOf, resolveBranchTab } from '../../../features/branch/branchTabs';
import { useBranchIdentity } from '../../../features/branch/hooks/useBranchIdentity';
import { useBranchTab } from '../../../features/branch/hooks/useBranchTab';
import { openLens } from '../../../features/session/openLens';
import { sessionTitle } from '../../../features/session/sessionTitle';
import { RailButton } from './RailButton';

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

  return (
    <div data-rail-level="worktree" className="flex flex-col items-center gap-1">
      <RailButton
        id="level-back"
        icon={ChevronLeft}
        label={`Back to session ${sessionTitle({ session })}`}
        shortcut="nav.back"
        isCurrent={false}
        isPage
        onSelect={() => openLens({ sessionId, lens: null })}
      />
      {branchTabsOf(scope).map((entry) => (
        <RailButton
          key={entry.id}
          id={`worktree-${entry.id}`}
          icon={ENTRY_ICON[entry.id]}
          label={entry.label}
          {...(entry.shortcut !== null && { shortcut: entry.shortcut })}
          isCurrent={tab === entry.id}
          isPage
          onSelect={() =>
            navigate({
              to: branchPlace({ sessionId, mountPath: identity.mountPath, tab: entry.id }),
              mode: 'replace',
            })
          }
        />
      ))}
    </div>
  );
};
