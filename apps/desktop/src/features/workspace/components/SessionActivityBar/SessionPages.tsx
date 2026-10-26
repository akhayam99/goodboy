import { ICON_SIZE, SelectableRow, StatusDot, Tooltip } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';

import { navEntryToneOf } from '../../../../shared/components/navEntryToneOf';
import { openSessionPage } from '../../../session/openSessionPage';
import type { PageCountFacts } from '../../../session/pageCountWord';
import type { Page } from '../../../session/pageRegistry';
import { pageSlotOf } from '../../../session/pageSlot';
import type { CurrentSign } from './currentSign';

type Props = {
  readonly session: Session;
  readonly pages: ReadonlyArray<Page>;
  readonly facts: PageCountFacts;
  readonly sign: CurrentSign;
  readonly onOpened?: () => void;
};

export const SessionPages = ({ session, pages, facts, sign, onOpened }: Props) => {
  const sessionId = session.id as SessionId;

  const openPage = (page: Page) => {
    openSessionPage({ sessionId, page });
    onOpened?.();
  };

  return (
    <ul aria-label="Pages" className="flex flex-col" data-testid="session-pages">
      {pages.map((page) => {
        const Icon = page.icon;
        const isCurrent = sign === page.id;
        const slot = pageSlotOf({ page: page.count, facts });
        const count = (
          <span
            data-page-value={page.id}
            data-tone={slot.tone ?? 'count'}
            className="flex shrink-0 items-center justify-end gap-1 text-meta tabular-nums text-faint-foreground empty:hidden"
          >
            {slot.tone === null ? null : <StatusDot tone={slot.tone} size="sm" />}
            {slot.text === null ? null : <span>{slot.text}</span>}
          </span>
        );
        return (
          <li key={page.id}>
            <SelectableRow
              selected={isCurrent}
              selectedIconTone={navEntryToneOf({ icon: Icon })}
              ariaCurrent={isCurrent ? 'page' : undefined}
              onClick={() => openPage(page)}
              className="h-7 items-center gap-2 px-2 text-ui"
            >
              <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{page.label}</span>
              {slot.fact === null ? (
                count
              ) : (
                <Tooltip content={slot.fact} side="right">
                  {count}
                </Tooltip>
              )}
            </SelectableRow>
          </li>
        );
      })}
    </ul>
  );
};
