import { useContext } from 'react';
import { PageColumn } from '@goodboy/ui';
import { PageCrumbContext } from './PageCrumbContext';

type Props = {
  readonly isFramed?: boolean;
};

export const PageCrumbRow = ({ isFramed = true }: Props) => {
  const crumb = useContext(PageCrumbContext);
  if (crumb == null) {
    return null;
  }
  const row = (
    <div data-slot="page-crumb" className="flex h-6 min-w-0 shrink-0 items-center">
      {crumb}
    </div>
  );
  if (!isFramed) {
    return row;
  }
  return <PageColumn className="shrink-0 pt-3">{row}</PageColumn>;
};
