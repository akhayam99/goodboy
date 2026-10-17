import { StatusDot } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import type { Session } from '@goodboy/types';
import { openSessionPage } from '../../../features/session/openSessionPage';
import { pageSlotOf } from '../../../features/session/pageSlot';
import { useSessionPageLens } from '../../../features/session/hooks/useSessionPageLens';
import { currentSignOf } from '../../../features/workspace/components/SessionActivityBar/currentSign';
import { useCardPages } from '../../../features/workspace/hooks/useCardPages';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import { RailButton } from '../SideColumn/RailButton';
import { RailWorktrees } from './RailWorktrees';

type Props = {
  readonly session: Session;
};

export const RailSessionLevel = ({ session }: Props) => {
  const sessionId = session.id;
  const { pages, facts } = useCardPages({ session });
  const pageLens = useSessionPageLens({ session });
  const isBranchless = useAppStore((state) =>
    isBranchlessSession({ branch: state.sessionBranches[sessionId] }),
  );
  const sign = currentSignOf({
    activeLens: pageLens,
    pages,
    hasStudioOver: false,
  });

  return (
    <div data-rail-level="session" className="flex flex-col gap-1 px-2">
      <div className="flex flex-col">
        {pages.map((page) => {
          const slot = pageSlotOf({ page: page.count, facts });
          const isCurrent = sign === page.id;
          return (
            <RailButton
              key={page.id}
              id={`page-${page.id}`}
              icon={page.icon}
              iconSize={ICON_SIZE.row}
              label={slot.fact === null ? page.label : `${page.label}, ${slot.fact}`}
              shortcut={page.shortcut}
              isCurrent={isCurrent}
              isPage
              {...(slot.tone !== null && {
                badge: (
                  <span aria-hidden className="absolute right-0.5 top-0.5 flex">
                    <StatusDot tone={slot.tone} size="sm" />
                  </span>
                ),
              })}
              onSelect={() => openSessionPage({ sessionId, page })}
            />
          );
        })}
      </div>
      {isBranchless ? null : <RailWorktrees session={session} />}
    </div>
  );
};
