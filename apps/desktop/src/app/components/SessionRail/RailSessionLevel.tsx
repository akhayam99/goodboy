import { StatusDot } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { openSessionPage } from '../../../features/session/openSessionPage';
import { pageSlotOf } from '../../../features/session/pageSlot';
import { useSessionPageLens } from '../../../features/session/hooks/useSessionPageLens';
import { currentSignOf } from '../../../features/workspace/components/SessionActivityBar/currentSign';
import { useCardPages } from '../../../features/workspace/hooks/useCardPages';
import { RailButton } from '../SideColumn/RailButton';

type Props = {
  readonly session: Session;
};

export const RailSessionLevel = ({ session }: Props) => {
  const sessionId = session.id;
  const { pages, facts } = useCardPages({ session });
  const pageLens = useSessionPageLens({ session });
  const sign = currentSignOf({
    activeLens: pageLens,
    pages,
    hasStudioOver: false,
  });

  return (
    <div data-rail-level="session" className="flex flex-col items-center gap-1">
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
