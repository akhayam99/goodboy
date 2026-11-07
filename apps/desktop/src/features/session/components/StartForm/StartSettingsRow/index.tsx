import { Fragment, useState, type ReactNode } from 'react';
import { Button } from '@goodboy/ui';
import { START_KIND_COPY } from '../../../startKind/startKindCopy';
import { START_MORE_KEYS } from '../startMoreKeys';
import type { StartSettingItem } from '../startSettingsOf';

type Props = {
  readonly items: ReadonlyArray<StartSettingItem>;
  readonly lead?: ReactNode;
};

export const StartSettingsRow = ({ items, lead = null }: Props) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  if (items.length === 0 && lead === null) {
    return null;
  }
  const tucked = items.filter((item) => START_MORE_KEYS.includes(item.key) && !item.isChanged);
  const shown = isMoreOpen ? items : items.filter((item) => !tucked.includes(item));
  return (
    <div
      role="group"
      aria-label={START_KIND_COPY.settings}
      className="flex min-w-0 flex-wrap items-center gap-1"
    >
      {lead}
      {shown.map((item) => (
        <Fragment key={item.key}>{item.node}</Fragment>
      ))}
      {tucked.length === 0 ? null : (
        <Button
          size="xs"
          variant="ghost"
          aria-expanded={isMoreOpen}
          onClick={() => setIsMoreOpen(!isMoreOpen)}
        >
          {isMoreOpen ? START_KIND_COPY.less : `${START_KIND_COPY.more} ${tucked.length}`}
        </Button>
      )}
    </div>
  );
};
