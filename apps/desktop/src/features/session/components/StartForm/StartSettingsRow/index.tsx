import { Fragment, useState } from 'react';
import { Button, cn } from '@goodboy/ui';
import { openRunDefaults } from '../../../../settings/openRunDefaults';
import { START_KIND_COPY } from '../../../startKind/startKindCopy';
import { START_SENTENCE_ORDER } from '../startFormKinds';
import type { StartSettingItem } from '../startSettingsOf';

type Props = {
  readonly items: ReadonlyArray<StartSettingItem>;
  readonly className?: string;
};

export const StartSettingsRow = ({ items, className }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  if (items.length === 0) {
    return null;
  }
  const words = START_SENTENCE_ORDER.flatMap((key) =>
    items.flatMap((item) => (item.key === key && item.words !== null ? [item.words] : [])),
  );
  return (
    <div
      role="group"
      aria-label={START_KIND_COPY.settings}
      className={cn('flex min-w-0 flex-col gap-2', className)}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p data-start-settings-line="" className="min-w-0 text-meta text-muted-foreground">
          {words.map((word, index) => (
            <Fragment key={`${word.lead}${word.value}`}>
              {index === 0 ? null : <span aria-hidden> · </span>}
              {word.lead === '' ? null : `${word.lead} `}
              <span className="text-eyebrow text-foreground">{word.value}</span>
            </Fragment>
          ))}
        </p>
        <Button
          size="xs"
          variant="quiet"
          className="shrink-0"
          aria-expanded={isOpen}
          data-start-settings-change=""
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? START_KIND_COPY.done : START_KIND_COPY.change}
        </Button>
      </div>
      {isOpen ? (
        <div className="flex min-w-0 flex-col gap-2 rounded-lg bg-subtle p-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {items.map((item) => (
              <Fragment key={item.key}>{item.node}</Fragment>
            ))}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <Button size="xs" variant="quiet" data-start-defaults-door="" onClick={openRunDefaults}>
              {START_KIND_COPY.defaultsDoor}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
