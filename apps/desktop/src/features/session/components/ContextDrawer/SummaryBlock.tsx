import { useId, useMemo, useState } from 'react';
import type { IconGlyph } from '@goodboy/ui/icons';
import { Button, EmptyLine } from '@goodboy/ui';
import { ContextBlock } from './ContextBlock';
import { SummaryFactList } from './SummaryFactList';
import { SummaryStepList } from './SummaryStepList';
import { summaryItems } from './summaryItems';

const PREVIEW_COUNT = 3;

type Props = {
  readonly title: string;
  readonly body: string;
  readonly icon?: IconGlyph;
  readonly isOrdered?: boolean;
};

export const SummaryBlock = ({ title, body, icon, isOrdered = false }: Props) => {
  const items = useMemo(() => summaryItems({ body }), [body]);
  const [isOpen, setIsOpen] = useState(false);
  const listId = useId();
  const canFold = items.length > PREVIEW_COUNT;
  const shown = canFold && !isOpen ? items.slice(0, PREVIEW_COUNT) : items;
  const List = isOrdered ? SummaryStepList : SummaryFactList;

  return (
    <ContextBlock
      title={title}
      icon={icon}
      count={items.length > 0 ? items.length : undefined}
      action={
        canFold ? (
          <Button
            variant="quiet"
            size="xs"
            aria-expanded={isOpen}
            aria-controls={listId}
            data-summary-fold=""
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? 'Show fewer' : `Show all ${items.length}`}
          </Button>
        ) : undefined
      }
    >
      {items.length > 0 ? (
        <List id={listId} label={title} items={shown} />
      ) : (
        <EmptyLine>Nothing yet.</EmptyLine>
      )}
    </ContextBlock>
  );
};
