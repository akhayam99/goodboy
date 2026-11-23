import { cn, PageTabs, tintClasses, type PageTabOption } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useSessionPageLens } from '../../../features/session/hooks/useSessionPageLens';
import { openSessionPage } from '../../../features/session/openSessionPage';
import { pageSlotOf } from '../../../features/session/pageSlot';
import type { Page } from '../../../features/session/pageRegistry';
import { currentSignOf } from './currentSign';
import { useCardPages } from '../../../features/workspace/hooks/useCardPages';

type Props = {
  readonly session: Session;
};

const COUNTED: ReadonlySet<Page['id']> = new Set(['runs', 'artifacts', 'questions']);

export const SessionPageTabs = ({ session }: Props) => {
  const { pages, facts } = useCardPages({ session });
  const lens = useSessionPageLens({ session });
  const current = currentSignOf({ activeLens: lens, pages, hasStudioOver: false });
  const options = pages.map((page): PageTabOption<Page['id']> => {
    const slot = COUNTED.has(page.id) ? pageSlotOf({ page: page.count, facts }) : null;
    return {
      value: page.id,
      label: page.label,
      ...(slot !== null &&
        slot.text !== null && {
          badge: (
            <span
              data-tab-count=""
              data-tab-count-tone={slot.tone ?? 'neutral'}
              className={cn(
                'shrink-0 text-chip tabular-nums',
                slot.tone === null ? 'text-faint-foreground' : tintClasses(slot.tone).text,
              )}
            >
              {slot.text}
            </span>
          ),
        }),
      ...(slot !== null && slot.fact !== null && { tooltip: slot.fact }),
    };
  });
  const value = pages.find((page) => page.id === current)?.id ?? null;
  return (
    <div className="flex min-w-0 flex-col">
      <PageTabs
        ariaLabel="Session pages"
        options={options}
        value={value}
        onChange={(id) => {
          const page = pages.find((entry) => entry.id === id);
          if (page === undefined) {
            return;
          }
          openSessionPage({ sessionId: session.id, page });
        }}
      />
    </div>
  );
};
