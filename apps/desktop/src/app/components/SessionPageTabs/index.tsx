import { PageTabs, StatusDot, type PageTabOption } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { TONE_COUNT_CLASS } from '../../../shared/components/toneCountClass';
import { useSessionPageLens } from '../../../features/session/hooks/useSessionPageLens';
import { openSessionPage } from '../../../features/session/openSessionPage';
import { pageSlotOf } from '../../../features/session/pageSlot';
import type { Page } from '../../../features/session/pageRegistry';
import { currentSignOf } from '../../../features/workspace/components/SessionActivityBar/currentSign';
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
            <span data-tab-count="" className={TONE_COUNT_CLASS}>
              {slot.tone === null ? null : <StatusDot tone={slot.tone} size="sm" />}
              <span>{slot.text}</span>
            </span>
          ),
        }),
      ...(slot !== null && slot.fact !== null && { tooltip: slot.fact }),
    };
  });
  const value = pages.find((page) => page.id === current)?.id ?? null;
  return (
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
  );
};
