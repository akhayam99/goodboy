import { ChevronLeft } from 'lucide-react';
import { StatusDot } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import { openSessionPage } from '../../../features/session/openSessionPage';
import { pageSlotOf } from '../../../features/session/pageSlot';
import { supportedLens } from '../../../features/session/supportedLens';
import { currentSignOf } from '../../../features/workspace/components/SessionActivityBar/currentSign';
import { useCardPages } from '../../../features/workspace/hooks/useCardPages';
import { RailButton } from './RailButton';

type Props = {
  readonly session: Session;
};

export const RailSessionLevel = ({ session }: Props) => {
  const sessionId = session.id;
  const { pages, facts } = useCardPages({ session });
  const leaveSessionLevel = useAppStore((state) => state.leaveSessionLevel);
  const storedLens = useAppStore((state) => state.activeLens[sessionId] ?? null);
  const isBranchless = useAppStore((state) =>
    isBranchlessSession({ branch: state.sessionBranches[sessionId] }),
  );
  const sign = currentSignOf({
    activeLens: supportedLens({ lens: storedLens, isBranchless }),
    pages,
    hasStudioOver: false,
  });

  return (
    <div data-rail-level="session" className="flex flex-col items-center gap-1">
      <RailButton
        id="level-back"
        icon={ChevronLeft}
        label="Back to Sessions"
        shortcut="nav.back"
        isCurrent={false}
        isPage
        onSelect={leaveSessionLevel}
      />
      {pages.map((page) => {
        const slot = pageSlotOf({ page: page.count, facts });
        const isCurrent = sign === page.id;
        return (
          <RailButton
            key={page.id}
            id={`page-${page.id}`}
            icon={page.icon}
            label={slot.fact === null ? page.label : `${page.label}, ${slot.fact}`}
            shortcut={page.shortcut}
            isCurrent={isCurrent}
            isPage
            {...((slot.isRunning || slot.isWarning) && {
              badge: (
                <span aria-hidden className="absolute right-0.5 top-0.5 flex">
                  <StatusDot tone={slot.isWarning ? 'warning' : 'info'} size="sm" />
                </span>
              ),
            })}
            onSelect={() => openSessionPage({ sessionId, page })}
          />
        );
      })}
    </div>
  );
};
