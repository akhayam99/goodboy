import type { ReactNode } from 'react';
import { PAGE_MEASURE, PageColumn } from '@goodboy/ui';

type Props = {
  readonly className?: string;
  readonly children: ReactNode;
};

export const ConversationColumn = ({ className = '', children }: Props) => (
  <PageColumn width={PAGE_MEASURE.agent} className={className}>
    {children}
  </PageColumn>
);
