import { Chip, SelectableRow, StatusDot } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
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
        return (
          <li key={page.id}>
            <SelectableRow
              selected={isCurrent}
              ariaCurrent={isCurrent ? 'page' : undefined}
              {...(slot.fact !== null && { title: slot.fact })}
              onClick={() => openPage(page)}
              className="h-7 items-center gap-2 px-2 text-label"
            >
              <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="min-w-0 truncate">{page.label}</span>
                {page.id === 'auto' ? (
                  <Chip tone="neutral" kind="state" shape="badge" label="Experimental" />
                ) : null}
              </span>
              <span
                data-page-value={page.id}
                data-tone={slot.isWarning ? 'warning' : slot.isRunning ? 'running' : 'count'}
                className="flex w-10 shrink-0 items-center justify-end gap-1 text-meta tabular-nums text-faint-foreground"
              >
                {slot.isRunning ? <StatusDot tone="info" size="sm" /> : null}
                {slot.isWarning ? <StatusDot tone="warning" size="sm" /> : null}
                {slot.count === null ? null : <span>{slot.count}</span>}
              </span>
            </SelectableRow>
          </li>
        );
      })}
    </ul>
  );
};
