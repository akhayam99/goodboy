import type { ReactNode } from 'react';
import { Tooltip } from '@goodboy/ui';
import { ARCHIVED_SESSION_REASON } from '../../archivedSession';

type Props = {
  readonly isArchived: boolean;
  readonly children: ReactNode;
};

export const ArchivedGate = ({ isArchived, children }: Props) => {
  if (!isArchived) {
    return <>{children}</>;
  }
  return (
    <Tooltip content={ARCHIVED_SESSION_REASON}>
      <fieldset disabled aria-label={ARCHIVED_SESSION_REASON} className="min-w-0">
        {children}
      </fieldset>
    </Tooltip>
  );
};
