import { ICON_SIZE, SelectableRow, StatusDot, cn } from '@goodboy/ui';

import { navEntryToneOf } from '../../../shared/components/navEntryToneOf';
import { TONE_COUNT_CLASS } from '../../../shared/components/toneCountClass';
import type { PageCountFacts } from '../../../features/session/pageCountWord';
import type { Page } from '../../../features/session/pageRegistry';
import { pageSlotOf } from '../../../features/session/pageSlot';

type Props = {
  readonly page: Page;
  readonly facts: PageCountFacts;
  readonly isCurrent: boolean;
  readonly onOpen: () => void;
};

export const SessionPageRow = ({ page, facts, isCurrent, onOpen }: Props) => {
  const Icon = page.icon;
  const slot = pageSlotOf({ page: page.count, facts });
  const label = slot.fact === null ? page.label : `${page.label}, ${slot.fact}`;
  return (
    <SelectableRow
      selected={isCurrent}
      selectedIconTone={navEntryToneOf({ icon: Icon })}
      ariaCurrent={isCurrent ? 'page' : undefined}
      title={label}
      shortcut={page.shortcut}
      tooltipSide="right"
      onClick={onOpen}
      className="h-7 items-center gap-2 px-2 text-ui"
    >
      <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{page.label}</span>
      <span
        data-page-value={page.id}
        data-tone={slot.tone ?? 'count'}
        className={cn(TONE_COUNT_CLASS, 'empty:hidden')}
      >
        {slot.tone === null ? null : <StatusDot tone={slot.tone} size="sm" />}
        {slot.text === null ? null : <span>{slot.text}</span>}
      </span>
    </SelectableRow>
  );
};
