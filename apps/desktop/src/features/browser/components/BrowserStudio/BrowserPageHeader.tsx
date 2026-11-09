import type { ReactNode } from 'react';
import { PageHeader } from '@goodboy/ui';

type Props = {
  readonly actions?: ReactNode;
};

export const BrowserPageHeader = ({ actions }: Props) => (
  <PageHeader page="browser" title="Browser" actions={actions} />
);
