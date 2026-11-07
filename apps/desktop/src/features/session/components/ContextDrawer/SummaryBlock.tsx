import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { EmptyLine } from '@goodboy/ui';
import { ContextBlock } from './ContextBlock';
import { KeyLineList } from './KeyLineList';
import { summaryItems } from './summaryItems';

type Props = {
  readonly title: string;
  readonly body: string;
  readonly icon?: LucideIcon;
};

export const SummaryBlock = ({ title, body, icon }: Props) => {
  const items = useMemo(() => summaryItems({ body }), [body]);
  return (
    <ContextBlock title={title} icon={icon} count={items.length > 0 ? items.length : undefined}>
      {items.length > 0 ? (
        <KeyLineList items={items} label={title} />
      ) : (
        <EmptyLine className="text-meta text-faint-foreground">Nothing yet.</EmptyLine>
      )}
    </ContextBlock>
  );
};
